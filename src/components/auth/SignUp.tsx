import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { FirebaseError } from 'firebase/app';
import { EmailIcon, LockIcon } from '@chakra-ui/icons';

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
    <Flex 
      minHeight="100vh" 
      width="full" 
      align="center" 
      justifyContent="center"
      bg="gray.50"
    >
      <Container maxW="md" py={12} px={6}>
        <VStack spacing={8}>
          {/* Logo and Title */}
          <VStack spacing={2} textAlign="center">
            <Heading 
              as="h1" 
              fontSize="3xl" 
              fontWeight="bold"
              color="brand.700"
            >
              Del Norte Course Selector
            </Heading>
            <Text fontSize="lg" color="gray.600">
              Create your account
            </Text>
          </VStack>

          {/* Signup Form */}
          <Box 
            py={8} 
            px={8} 
            width="100%" 
            borderWidth={1} 
            borderRadius="xl" 
            boxShadow="xl" 
            bg="white"
          >
            <form onSubmit={handleSubmit}>
              <Stack spacing={6}>
                <FormControl id="email" isRequired>
                  <FormLabel fontWeight="medium">Email</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <EmailIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      required
                      disabled={loading}
                      size="lg"
                      borderRadius="md"
                      focusBorderColor="brand.500"
                    />
                  </InputGroup>
                </FormControl>

                <FormControl id="password" isRequired>
                  <FormLabel fontWeight="medium">Password</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <LockIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      size="lg"
                      borderRadius="md"
                      focusBorderColor="brand.500"
                    />
                  </InputGroup>
                </FormControl>

                <FormControl id="confirmPassword" isRequired>
                  <FormLabel fontWeight="medium">Confirm Password</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <LockIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      size="lg"
                      borderRadius="md"
                      focusBorderColor="brand.500"
                    />
                  </InputGroup>
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="brand"
                  size="lg"
                  fontSize="md"
                  width="100%"
                  isLoading={loading}
                  loadingText="Creating Account..."
                  boxShadow="md"
                  _hover={{
                    transform: 'translateY(-2px)',
                    boxShadow: 'lg',
                  }}
                  _active={{
                    transform: 'translateY(0)',
                    boxShadow: 'md',
                  }}
                >
                  Create Account
                </Button>
              </Stack>
            </form>
          </Box>

          <Box textAlign="center" pt={2}>
            <Text color="gray.600">
              Already have an account?{' '}
              <Button
                variant="link"
                colorScheme="brand"
                onClick={() => navigate('/login')}
                isDisabled={loading}
                fontWeight="semibold"
              >
                Sign in
              </Button>
            </Text>
          </Box>
        </VStack>
      </Container>
    </Flex>
  );
};

export default SignUp;
