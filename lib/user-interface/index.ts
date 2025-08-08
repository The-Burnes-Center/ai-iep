import * as cdk from "aws-cdk-lib";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import {
  ExecSyncOptionsWithBufferEncoding,
  execSync,
} from "node:child_process";
import * as path from "node:path";
import { ChatBotApi } from "../chatbot-api";
import { Website } from "./generate-app"
import { NagSuppressions } from "cdk-nag";
import { Utils } from "../shared/utils"
import { OIDCIntegrationName } from "../constants";
import * as kms from 'aws-cdk-lib/aws-kms';

export interface UserInterfaceProps {
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly api: ChatBotApi;
  readonly cognitoDomain : string;
  readonly kmsKey?: kms.IKey;
}

export class UserInterface extends Construct {
  public readonly websiteDistribution: cf.CloudFrontWebDistribution;

  constructor(scope: Construct, id: string, props: UserInterfaceProps) {
    super(scope, id);

    const appPath = path.join(__dirname, "app");
    const buildPath = path.join(appPath, "dist");

    const uploadLogsBucket = new s3.Bucket(this, "WebsiteLogsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      enforceSSL: true,
      versioned: true,
      ...(props.kmsKey ? { encryption: s3.BucketEncryption.KMS, encryptionKey: props.kmsKey } : {}),
    });

    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: false,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      enforceSSL: true,
      versioned: true,
      serverAccessLogsBucket: uploadLogsBucket,
      ...(props.kmsKey ? { encryption: s3.BucketEncryption.KMS, encryptionKey: props.kmsKey } : {}),
    });

    // Deploy either Private (only accessible within VPC) or Public facing website
    let apiEndpoint: string;
    let distribution;

    const publicWebsite = new Website(this, "Website", { ...props, websiteBucket: websiteBucket, kmsKey: props.kmsKey });
    distribution = publicWebsite.distribution
    this.websiteDistribution = distribution;

    const exportsAsset = s3deploy.Source.jsonData("aws-exports.json", {
      Auth: {
        region: cdk.Aws.REGION,
        userPoolId: props.userPoolId,
        userPoolWebClientId: props.userPoolClientId,
        oauth: {
          domain: props.cognitoDomain.concat(`.auth.${cdk.Aws.REGION}.amazoncognito.com`),
          scope: ["aws.cognito.signin.user.admin","email", "openid", "profile"],
          redirectSignIn: "https://" + distribution.distributionDomainName,
          redirectSignOut: "https://" + distribution.distributionDomainName,
          responseType: "code"
        }
      },
      httpEndpoint : props.api.httpAPI.restAPI.url,
      federatedSignInProvider : OIDCIntegrationName
    });

    const asset = s3deploy.Source.asset(appPath, {
      bundling: {
        image: cdk.DockerImage.fromRegistry(
          "public.ecr.aws/sam/build-nodejs18.x:latest"
        ),
        command: [
          "sh",
          "-c",
          [
            "npm --cache /tmp/.npm install",
            `npm --cache /tmp/.npm run build`,
            "cp -aur /asset-input/dist/* /asset-output/",
          ].join(" && "),
        ],
        local: {
          tryBundle(outputDir: string) {
            try {
              const options: ExecSyncOptionsWithBufferEncoding = {
                stdio: "inherit",
                env: {
                  ...process.env,
                },
              };

              console.log('Installing dependencies...');
              execSync(`npm --silent --prefix "${appPath}" ci`, options);
              
              console.log('Building application...');
              execSync(`npm --silent --prefix "${appPath}" run build`, options);
              
              console.log('Copying build files...');
              try {
                Utils.copyDirRecursive(buildPath, outputDir);
                console.log('Build process completed successfully');
              } catch (e) {
                console.error('Failed to copy build files:', e);
                return false;
              }
            } catch (e) {
              console.error('Build process failed:', e);
              return false;
            }

            return true;
          },
        },
      },
    });

    new s3deploy.BucketDeployment(this, "UserInterfaceDeployment", {
      prune: false,
      sources: [asset, exportsAsset],
      destinationBucket: websiteBucket,
      distribution: distribution
    });


    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(
      uploadLogsBucket,
      [
        {
          id: "AwsSolutions-S1",
          reason: "Bucket is the server access logs bucket for websiteBucket.",
        },
      ]
    );
  }
}
