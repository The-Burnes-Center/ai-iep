import json
import boto3
import os


def lambda_handler(event, context):
    payload = json.loads(event['body'])

    try:
        s3 = boto3.resource('s3')
        return s3.Object(os.environ['BUCKET'], payload['KEY']).delete()
    except:
        return {
            'statusCode': 502,
            'body': json.dumps('FAILED')
        }
