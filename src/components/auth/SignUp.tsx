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

const SignUp: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Error',
        description: 'Password should be at least 6 characters',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setLoading(true);
      await signup(email, password);
      toast({
        title: 'Account created',
        description: 'You have successfully signed up!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/');
    } catch (error) {
      const firebaseError = error as FirebaseError;
      let errorMessage = 'Failed to create an account';
      
      if (firebaseError.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already registered';
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (firebaseError.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled';
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
          <Heading size="lg">Sign Up</Heading>
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
              <Box>
                <Text mb={2}>Confirm Password</Text>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </Box>
              <Button
                type="submit"
                colorScheme="blue"
                width="100%"
                isLoading={loading}
                loadingText="Creating Account..."
              >
                Sign Up
              </Button>
            </Stack>
          </form>
          
          <Text>
            Already have an account?{' '}
            <Button
              variant="link"
              colorScheme="blue"
              onClick={() => navigate('/login')}
              size="sm"
              isDisabled={loading}
            >
              Log in
            </Button>
          </Text>
        </Stack>
      </Box>
    </Container>
  );
};

export default SignUp;
