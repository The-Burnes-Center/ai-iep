import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import LandingTopNavigation from '../components/LandingTopNavigation';
import './LandingPage.css';

const LandingPage: React.FC = () => { 
    return (
        <>
        <LandingTopNavigation />
        <Container >
            <Row>
                <Col>
                    <h1>Landing Page</h1>
                </Col>
            </Row>
        </Container>
        </>

    )
}

export default LandingPage;