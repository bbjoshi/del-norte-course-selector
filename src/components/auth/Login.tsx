import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { FirebaseError } from 'firebase/app';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (error) {
      const firebaseError = error as FirebaseError;
      let errorMessage = 'Failed to log in';
      
      if (firebaseError.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (firebaseError.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="container.sm" py={10}>
      <Box p={8} borderWidth={1} borderRadius={8} boxShadow="lg" bg="white">
        <Stack spacing={4} align="center">
          <Heading size="lg">Login</Heading>
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <Stack spacing={4}>
              <Box>
                <Text mb={2}>Email</Text>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </Box>
              <Box>
                <Text mb={2}>Password</Text>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </Box>
              <Button
                type="submit"
                colorScheme="blue"
                width="100%"
                isLoading={loading}
                loadingText="Logging in..."
              >
                Login
              </Button>
            </Stack>
          </form>
          
          <Text>
            Don't have an account?{' '}
            <Button
              variant="link"
              colorScheme="blue"
              onClick={() => navigate('/signup')}
              size="sm"
              isDisabled={loading}
            >
              Sign up
            </Button>
          </Text>
        </Stack>
      </Box>
    </Container>
  );
};

export default Login;
