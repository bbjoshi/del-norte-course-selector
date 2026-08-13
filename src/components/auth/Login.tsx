import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Box,
  Button,
  Collapse,
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
  useColorModeValue,
} from '@chakra-ui/react';
import { FirebaseError } from '@firebase/app';
import { EmailIcon, LockIcon } from '@chakra-ui/icons';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot-password state
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Color-mode values
  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const forgotBg = useColorModeValue('blue.50', 'gray.700');
  const forgotBorder = useColorModeValue('blue.200', 'gray.500');

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
      } else if (firebaseError.code === 'auth/invalid-credential') {
        errorMessage = 'Incorrect email or password';
      }
      toast({ title: 'Error', description: errorMessage, status: 'error', duration: 3000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    try {
      setResetLoading(true);
      await resetPassword(resetEmail.trim());
      setResetSent(true);
    } catch (error) {
      const firebaseError = error as FirebaseError;
      let msg = 'Failed to send reset email';
      if (firebaseError.code === 'auth/user-not-found') msg = 'No account found with this email';
      if (firebaseError.code === 'auth/invalid-email') msg = 'Invalid email address';
      toast({ title: 'Error', description: msg, status: 'error', duration: 3000, isClosable: true });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <Flex minHeight="100vh" width="full" align="center" justifyContent="center" bg={pageBg}>
      <Container maxW="md" py={12} px={6}>
        <VStack spacing={8}>
          {/* Logo and Title */}
          <VStack spacing={2} textAlign="center">
            <Heading as="h1" fontSize="3xl" fontWeight="bold" color="brand.700">
              Del Norte Course Selector
            </Heading>
            <Text fontSize="lg" color="gray.600">
              Sign in to access your account
            </Text>
          </VStack>

          {/* Login Form */}
          <Box py={8} px={8} width="100%" borderWidth={1} borderRadius="xl" boxShadow="xl" bg={cardBg}>
            <form onSubmit={handleSubmit}>
              <Stack spacing={5}>
                <FormControl id="email" isRequired>
                  <FormLabel fontWeight="medium">Email</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <EmailIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setResetEmail(e.target.value); }}
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
                  <Flex justify="space-between" align="baseline">
                    <FormLabel fontWeight="medium" mb={0}>Password</FormLabel>
                    <Button
                      variant="link"
                      colorScheme="brand"
                      fontSize="xs"
                      fontWeight="medium"
                      onClick={() => { setShowForgot(v => !v); setResetSent(false); if (!resetEmail) setResetEmail(email); }}
                      tabIndex={-1}
                    >
                      {showForgot ? 'Cancel' : 'Forgot password?'}
                    </Button>
                  </Flex>
                  <InputGroup mt={2}>
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

                {/* Forgot Password Panel */}
                <Collapse in={showForgot} animateOpacity>
                  <Box p={4} bg={forgotBg} borderRadius="lg" borderWidth={1} borderColor={forgotBorder}>
                    {resetSent ? (
                      <VStack spacing={2} align="start">
                        <Text fontSize="sm" color="green.600" fontWeight="medium">✅ Reset link sent!</Text>
                        <Text fontSize="sm" color="gray.600">
                          Check <strong>{resetEmail}</strong> for a password reset link. It may take a minute to arrive.
                        </Text>
                        <Button size="xs" variant="link" colorScheme="brand" onClick={() => { setResetSent(false); setShowForgot(false); }}>
                          Back to sign in
                        </Button>
                      </VStack>
                    ) : (
                      <form onSubmit={handleForgotPassword}>
                        <VStack spacing={3} align="stretch">
                          <Text fontSize="sm" color="gray.600">
                            Enter your email address and we'll send you a link to reset your password.
                          </Text>
                          <InputGroup size="sm">
                            <InputLeftElement pointerEvents="none">
                              <EmailIcon color="gray.400" boxSize={3} />
                            </InputLeftElement>
                            <Input
                              type="email"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              placeholder="your.email@example.com"
                              borderRadius="md"
                              focusBorderColor="brand.500"
                              required
                            />
                          </InputGroup>
                          <Button
                            type="submit"
                            colorScheme="brand"
                            size="sm"
                            isLoading={resetLoading}
                            loadingText="Sending..."
                            width="full"
                          >
                            Send Reset Link
                          </Button>
                        </VStack>
                      </form>
                    )}
                  </Box>
                </Collapse>

                <Button
                  type="submit"
                  colorScheme="brand"
                  size="lg"
                  fontSize="md"
                  width="100%"
                  isLoading={loading}
                  loadingText="Signing in..."
                  boxShadow="md"
                  _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
                  _active={{ transform: 'translateY(0)', boxShadow: 'md' }}
                >
                  Sign In
                </Button>
              </Stack>
            </form>
          </Box>

          <Box textAlign="center" pt={2}>
            <Text color="gray.600">
              Don't have an account?{' '}
              <Button
                variant="link"
                colorScheme="brand"
                onClick={() => navigate('/signup')}
                isDisabled={loading}
                fontWeight="semibold"
              >
                Sign up
              </Button>
            </Text>
          </Box>
        </VStack>
      </Container>
    </Flex>
  );
};

export default Login;
