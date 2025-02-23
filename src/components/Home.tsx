import React from 'react';
import { Box, Container, Heading, Text, Button, VStack } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChatInterface from './chat/ChatInterface';

const Home: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <Container maxW="container.lg" py={6}>
      <VStack spacing={6} align="stretch">
        <Box textAlign="center" mb={4}>
          <Heading size="xl" mb={2}>
            Del Norte Course Selector
          </Heading>
          <Text fontSize="lg" color="gray.600">
            Welcome to your personalized course selection assistant
          </Text>
        </Box>

        <Box p={4} borderWidth={1} borderRadius="lg" bg="white">
          <VStack spacing={4} align="stretch">
            <Text>
              Logged in as: <strong>{currentUser?.email}</strong>
            </Text>
            <Button onClick={handleLogout} colorScheme="red" size="sm">
              Log Out
            </Button>
          </VStack>
        </Box>

        <ChatInterface />
      </VStack>
    </Container>
  );
};

export default Home;
