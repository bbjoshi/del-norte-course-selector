import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  Input,
  Button,
  Text,
  Flex,
  useToast,
  InputGroup,
  InputRightElement,
  Heading,
  useColorModeValue,
  Spinner,
  Center,
  Progress,
  IconButton,
  Textarea,
  HStack,
  Collapse,
  Tooltip,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  useDisclosure,
  Badge,
} from '@chakra-ui/react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './ChatInterface.css';
import { PDFService } from '../../services/PDFService';
import { ChatService } from '../../services/ChatService';
import { AnalyticsService } from '../../services/AnalyticsService';

interface FeedbackState {
  rating: 'positive' | 'negative' | null;
  comment: string;
  submitted: boolean;
  showCommentBox: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  queryText?: string;
  feedback?: FeedbackState;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messageCount?: number;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [embeddingsStatus, setEmbeddingsStatus] = useState({
    inProgress: false,
    complete: false,
    error: null,
    progress: 0,
    vectorCount: 0,
    vectorSearchAvailable: false
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Theme colors
  const userBubbleBg = useColorModeValue('brand.600', 'brand.500');
  const botBubbleBg = useColorModeValue('white', 'gray.700');
  const botBubbleBorder = useColorModeValue('gray.200', 'gray.600');
  const chatBg = useColorModeValue('gray.50', 'gray.800');
  const feedbackBg = useColorModeValue('gray.50', 'gray.600');
  const sidebarHoverBg = useColorModeValue('gray.100', 'gray.600');
  const activeSessionBg = useColorModeValue('brand.50', 'brand.900');

  const [pdfService] = useState(() => PDFService.getInstance());
  const [chatService] = useState(() => ChatService.getInstance());
  const [uploadedDoc, setUploadedDoc] = useState<{ filename: string; type: string; label: string } | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load chat sessions from API
  const loadSessions = useCallback(async () => {
    try {
      const response = await axios.get('/api/chat-sessions');
      setChatSessions(response.data.sessions || []);
      return response.data.sessions || [];
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      return [];
    }
  }, []);

  // Save a message to the API
  const saveMessageToAPI = useCallback(async (sessionId: string, message: Message) => {
    try {
      await axios.post(`/api/chat-sessions/${sessionId}/messages`, {
        id: message.id,
        text: message.text,
        sender: message.sender,
        queryText: message.queryText || null,
        timestamp: message.timestamp.toISOString(),
      });
    } catch (error) {
      console.error('Error saving message to API:', error);
    }
  }, []);

  // Load messages for a session from API
  const loadSessionMessages = useCallback(async (sessionId: string): Promise<Message[]> => {
    try {
      const response = await axios.get(`/api/chat-sessions/${sessionId}`);
      const dbMessages = response.data.messages || [];
      return dbMessages.map((msg: any) => ({
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        timestamp: new Date(msg.timestamp),
        queryText: msg.query_text || undefined,
        feedback: msg.sender === 'bot' && msg.id !== 'welcome' ? {
          rating: msg.feedback_rating || null,
          comment: msg.feedback_comment || '',
          submitted: !!msg.feedback_submitted,
          showCommentBox: false,
        } : undefined,
      }));
    } catch (error) {
      console.error('Error loading session messages:', error);
      return [];
    }
  }, []);

  const createWelcomeMessage = (): Message => ({
    id: 'welcome',
    text: "👋 Hello! I'm your Del Norte High School course selection assistant. I can help you with:\n\n" +
          "- Finding specific courses and their requirements\n" +
          "- Creating a 4-year course plan\n" +
          "- Understanding graduation requirements\n" +
          "- Recommending courses based on your interests\n\n" +
          "How can I assist you today?",
    sender: 'bot',
    timestamp: new Date(),
  });

  const startNewChat = useCallback(() => {
    const newSessionId = `session_${Date.now()}`;
    setActiveSessionId(newSessionId);
    setMessages([createWelcomeMessage()]);
    onClose();
  }, [onClose]);

  const loadSession = useCallback(async (session: ChatSession) => {
    setActiveSessionId(session.id);
    const messages = await loadSessionMessages(session.id);
    if (messages.length > 0) {
      setMessages(messages);
    } else {
      setMessages([createWelcomeMessage()]);
    }
    onClose();
  }, [loadSessionMessages, onClose]);

  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await axios.delete(`/api/chat-sessions/${sessionId}`);
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
      if (sessionId === activeSessionId) {
        startNewChat();
      }
      toast({ title: 'Chat deleted', status: 'info', duration: 1500, isClosable: true });
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({ title: 'Error', description: 'Failed to delete chat', status: 'error', duration: 3000, isClosable: true });
    }
  }, [activeSessionId, startNewChat, toast]);

  const checkEmbeddingsStatus = async () => {
    try {
      const response = await axios.get('/api/embeddings-status');
      setEmbeddingsStatus(response.data);
      return response.data.complete || response.data.error ? true : false;
    } catch (error) {
      console.error('Error checking embeddings status:', error);
      return false;
    }
  };

  // Handle feedback
  const handleFeedbackRating = (messageId: string, rating: 'positive' | 'negative') => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const currentFeedback = msg.feedback || { rating: null, comment: '', submitted: false, showCommentBox: false };
        const isSameRating = currentFeedback.rating === rating;
        return {
          ...msg,
          feedback: { ...currentFeedback, rating: isSameRating ? null : rating, showCommentBox: !isSameRating, submitted: false }
        };
      }
      return msg;
    }));
  };

  const handleFeedbackComment = (messageId: string, comment: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.feedback) {
        return { ...msg, feedback: { ...msg.feedback, comment } };
      }
      return msg;
    }));
  };

  const submitFeedback = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message?.feedback?.rating) return;

    try {
      await axios.post('/api/feedback', {
        messageId: message.id,
        sessionId: activeSessionId,
        query: message.queryText || '',
        response: message.text,
        rating: message.feedback.rating,
        comment: message.feedback.comment,
        timestamp: new Date().toISOString(),
      });

      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId && msg.feedback) {
          return { ...msg, feedback: { ...msg.feedback, submitted: true, showCommentBox: false } };
        }
        return msg;
      }));

      // Track feedback
      AnalyticsService.trackFeedbackSubmitted(message.feedback.rating, !!message.feedback.comment);

      toast({ title: 'Thank you!', description: 'Your feedback has been recorded.', status: 'success', duration: 2000, isClosable: true });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({ title: 'Error', description: 'Failed to submit feedback.', status: 'error', duration: 3000, isClosable: true });
    }
  };

  // Initialize
  useEffect(() => {
    const initializePDF = async () => {
      try {
        setIsLoading(true);
        await pdfService.loadPDF('/api/pdf');
        await checkEmbeddingsStatus();
        setIsInitialized(true);

        // Load saved sessions from API
        const sessions = await loadSessions();

        if (sessions.length > 0) {
          // Load the most recent session
          const latestSession = sessions[0];
          setActiveSessionId(latestSession.id);
          const sessionMessages = await loadSessionMessages(latestSession.id);
          if (sessionMessages.length > 0) {
            setMessages(sessionMessages);
          } else {
            setMessages([createWelcomeMessage()]);
          }
        } else {
          const newId = `session_${Date.now()}`;
          setActiveSessionId(newId);
          setMessages([createWelcomeMessage()]);
        }

        if (embeddingsStatus.inProgress) {
          const pollInterval = setInterval(async () => {
            const isDone = await checkEmbeddingsStatus();
            if (isDone) clearInterval(pollInterval);
          }, 2000);
          return () => clearInterval(pollInterval);
        }
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load course catalog', status: 'error', duration: 5000, isClosable: true });
      } finally {
        setIsLoading(false);
      }
    };
    initializePDF();
  }, [pdfService, toast, loadSessions, loadSessionMessages]);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

  // Handle document upload (PDF, images, etc.)
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Unsupported file', description: 'Please upload a PDF or image (JPEG, PNG, WEBP, TIFF).', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    const isImage = file.type.startsWith('image/');
    setIsUploadingDoc(true);
    if (isImage) {
      toast({ title: 'Processing image...', description: 'Running OCR to extract text. This may take a moment.', status: 'info', duration: 8000, isClosable: true });
    }

    try {
      const formData = new FormData();
      formData.append('document', file);
      const response = await axios.post('/api/document/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 min timeout for OCR
      });

      if (response.data.success) {
        const { text, filename, charCount, documentType, extractionMethod, ocrConfidence } = response.data;
        chatService.setTranscript(text, filename);
        setUploadedDoc({ filename, type: documentType.type, label: documentType.label });

        let desc = `Detected as "${documentType.label}". ${charCount} characters extracted.`;
        if (extractionMethod.includes('ocr')) {
          desc += ` (OCR confidence: ${Math.round(ocrConfidence || 0)}%)`;
        }

        toast({
          title: `${documentType.label} uploaded!`,
          description: desc + ' Running AI analysis...',
          status: 'success',
          duration: 4000,
          isClosable: true,
        });

        // Run the agentic analysis pipeline in the background
        try {
          const analysis = await chatService.runAnalysis();
          if (analysis) {
            const coursesFound = analysis.courses?.length || 0;
            const gaps = analysis.gapAnalysis?.missingRequirements?.length || 0;
            toast({
              title: '📊 Analysis Complete!',
              description: `Found ${coursesFound} courses. ${gaps > 0 ? `${gaps} graduation requirement gaps identified.` : 'On track for graduation!'} Ask me for personalized recommendations.`,
              status: 'info',
              duration: 8000,
              isClosable: true,
            });
          }
        } catch (analysisErr) {
          console.warn('Analysis pipeline failed, will use raw text:', analysisErr);
        }
      }
    } catch (err: any) {
      console.error('Document upload failed:', err);
      const isScannedPdf = err.response?.data?.isScannedPdf;
      toast({
        title: isScannedPdf ? 'Scanned PDF detected' : 'Upload failed',
        description: err.response?.data?.error || 'Could not process the file. Try a different format or clearer image.',
        status: isScannedPdf ? 'warning' : 'error',
        duration: isScannedPdf ? 8000 : 5000,
        isClosable: true,
      });
    } finally {
      setIsUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const removeDocument = () => {
    chatService.clearTranscript();
    setUploadedDoc(null);
    toast({ title: 'Document removed', status: 'info', duration: 2000, isClosable: true });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isInitialized || !activeSessionId) return;

    const userQueryText = inputMessage.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userQueryText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Save user message to DB
    await saveMessageToAPI(activeSessionId, userMessage);

    // Track question asked
    AnalyticsService.trackQuestionAsked(userQueryText, activeSessionId);

    // Refresh sessions list (in case this created a new session)
    loadSessions();

    try {
      const response = await chatService.processQuery(userMessage.text);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'bot',
        timestamp: new Date(),
        queryText: userQueryText,
        feedback: { rating: null, comment: '', submitted: false, showCommentBox: false },
      };
      setMessages(prev => [...prev, botMessage]);

      // Save bot message to DB
      await saveMessageToAPI(activeSessionId, botMessage);

      // Track answer received
      AnalyticsService.trackAnswerReceived(response.length, activeSessionId);
      
      loadSessions();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to get response from the chatbot', status: 'error', duration: 3000, isClosable: true });
    } finally {
      setIsLoading(false);
    }
  };

  // Feedback section component
  const FeedbackSection: React.FC<{ message: Message }> = ({ message }) => {
    if (!message.feedback) return null;
    const { rating, comment, submitted, showCommentBox } = message.feedback;

    return (
      <Box mt={2} pt={2} borderTopWidth={1} borderColor={botBubbleBorder}>
        <HStack spacing={1} justify="flex-start" align="center">
          <Text fontSize="xs" color="gray.500" mr={1}>
            {submitted ? 'Thanks for your feedback!' : 'Was this helpful?'}
          </Text>
          {!submitted && (
            <>
              <Tooltip label="Helpful" placement="top" hasArrow>
                <IconButton aria-label="Thumbs up" icon={<span style={{ fontSize: '16px' }}>{rating === 'positive' ? '👍' : '👍🏻'}</span>} size="xs" variant={rating === 'positive' ? 'solid' : 'ghost'} colorScheme={rating === 'positive' ? 'green' : 'gray'} onClick={() => handleFeedbackRating(message.id, 'positive')} borderRadius="full" />
              </Tooltip>
              <Tooltip label="Not helpful" placement="top" hasArrow>
                <IconButton aria-label="Thumbs down" icon={<span style={{ fontSize: '16px' }}>{rating === 'negative' ? '👎' : '👎🏻'}</span>} size="xs" variant={rating === 'negative' ? 'solid' : 'ghost'} colorScheme={rating === 'negative' ? 'red' : 'gray'} onClick={() => handleFeedbackRating(message.id, 'negative')} borderRadius="full" />
              </Tooltip>
            </>
          )}
          {submitted && <Text fontSize="xs" color={rating === 'positive' ? 'green.500' : 'red.500'}>{rating === 'positive' ? '👍' : '👎'}</Text>}
        </HStack>
        <Collapse in={showCommentBox && !submitted} animateOpacity>
          <Box mt={2} p={2} bg={feedbackBg} borderRadius="md">
            <Text fontSize="xs" color="gray.600" mb={1}>{rating === 'negative' ? 'What was wrong or could be improved?' : 'What did you find helpful? (optional)'}</Text>
            <Textarea size="sm" fontSize="sm" placeholder={rating === 'negative' ? 'e.g., The information was incorrect...' : 'e.g., Great course recommendations...'} value={comment} onChange={(e) => handleFeedbackComment(message.id, e.target.value)} rows={2} resize="none" bg="white" borderColor="gray.300" _focus={{ borderColor: 'brand.500' }} />
            <HStack mt={2} justify="flex-end" spacing={2}>
              <Button size="xs" variant="ghost" onClick={() => { setMessages(prev => prev.map(msg => msg.id === message.id && msg.feedback ? { ...msg, feedback: { ...msg.feedback, showCommentBox: false, rating: null, comment: '' } } : msg)); }}>Cancel</Button>
              <Button size="xs" colorScheme="brand" onClick={() => submitFeedback(message.id)}>Submit</Button>
            </HStack>
          </Box>
        </Collapse>
        {submitted && comment && <Text fontSize="xs" color="gray.400" mt={1} fontStyle="italic">"{comment}"</Text>}
      </Box>
    );
  };

  const formatSessionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Box borderWidth={1} borderRadius="xl" overflow="hidden" bg="white" height="70vh" display="flex" flexDirection="column" boxShadow="lg">
      {/* Chat Header */}
      <Box p={4} borderBottomWidth={1} bg="brand.600" color="white">
        <Flex justify="space-between" align="center">
          <Heading size="md">Course Selection Assistant</Heading>
          <HStack spacing={2}>
            <Tooltip label="New Chat" placement="bottom" hasArrow>
              <IconButton aria-label="New chat" icon={<span style={{ fontSize: '18px' }}>✏️</span>} size="sm" variant="ghost" color="white" _hover={{ bg: 'brand.700' }} onClick={startNewChat} />
            </Tooltip>
            <Tooltip label="Chat History" placement="bottom" hasArrow>
              <IconButton aria-label="Chat history" icon={<span style={{ fontSize: '18px' }}>📋</span>} size="sm" variant="ghost" color="white" _hover={{ bg: 'brand.700' }} onClick={() => { loadSessions(); onOpen(); }} />
            </Tooltip>
            {chatSessions.length > 0 && <Badge colorScheme="whiteAlpha" variant="solid" fontSize="xs" borderRadius="full">{chatSessions.length}</Badge>}
          </HStack>
        </Flex>
      </Box>

      {/* Chat History Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="sm">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth={1}>
            <Flex justify="space-between" align="center" pr={8}>
              <Text>Chat History</Text>
              <Button size="sm" colorScheme="brand" onClick={startNewChat}>+ New Chat</Button>
            </Flex>
          </DrawerHeader>
          <DrawerBody p={0}>
            {chatSessions.length === 0 ? (
              <Center p={8}>
                <VStack spacing={2}>
                  <Text fontSize="lg">💬</Text>
                  <Text color="gray.500" textAlign="center" fontSize="sm">No previous chats yet. Start a conversation!</Text>
                </VStack>
              </Center>
            ) : (
              <VStack spacing={0} align="stretch">
                {chatSessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <Box key={session.id} px={4} py={3} cursor="pointer" bg={isActive ? activeSessionBg : 'transparent'} _hover={{ bg: isActive ? activeSessionBg : sidebarHoverBg }} onClick={() => loadSession(session)} borderBottomWidth={1} borderColor="gray.100">
                      <Flex justify="space-between" align="flex-start">
                        <Box flex={1} mr={2} overflow="hidden">
                          <Text fontSize="sm" fontWeight={isActive ? 'bold' : 'medium'} noOfLines={1} color={isActive ? 'brand.700' : 'gray.800'}>{session.title}</Text>
                          <Text fontSize="xs" color="gray.500" mt={1}>{formatSessionDate(session.updated_at)}</Text>
                        </Box>
                        <Tooltip label="Delete chat" placement="top" hasArrow>
                          <IconButton aria-label="Delete chat" icon={<span style={{ fontSize: '14px' }}>🗑️</span>} size="xs" variant="ghost" colorScheme="red" onClick={(e) => deleteSession(session.id, e)} opacity={0.5} _hover={{ opacity: 1 }} />
                        </Tooltip>
                      </Flex>
                    </Box>
                  );
                })}
              </VStack>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Messages Area */}
      {!isInitialized ? (
        <Center flex={1} bg={chatBg}><VStack spacing={4}><Spinner size="xl" color="brand.500" thickness="4px" /><Text color="gray.500">Loading course catalog...</Text></VStack></Center>
      ) : embeddingsStatus.inProgress ? (
        <Center flex={1} bg={chatBg}>
          <VStack spacing={4} width="80%">
            <Spinner size="md" color="brand.500" thickness="3px" />
            <Text color="gray.700" fontWeight="medium">Generating AI embeddings for better search results...</Text>
            <Progress value={embeddingsStatus.progress} size="sm" width="100%" colorScheme="brand" hasStripe isAnimated />
            <Text color="gray.500" fontSize="sm">{embeddingsStatus.progress}% complete ({embeddingsStatus.vectorCount} vectors generated)</Text>
            <Text color="gray.600" fontSize="sm" mt={2}>You can start chatting now, but search results will improve once this process completes.</Text>
          </VStack>
        </Center>
      ) : (
        <VStack flex={1} overflowY="auto" p={4} spacing={4} align="stretch" bg={chatBg}>
          {messages.map(message => (
            <Flex key={message.id} justify={message.sender === 'user' ? 'flex-end' : 'flex-start'}>
              <Box maxW={{ base: "85%", md: "70%" }} bg={message.sender === 'user' ? userBubbleBg : botBubbleBg} color={message.sender === 'user' ? 'white' : 'inherit'} p={4} borderRadius="lg" boxShadow="md" borderWidth={message.sender === 'bot' ? 1 : 0} borderColor={message.sender === 'bot' ? botBubbleBorder : 'transparent'}>
                {message.sender === 'user' ? (
                  <Text fontWeight="medium">{message.text}</Text>
                ) : (
                  <Box className="markdown-content"><ReactMarkdown>{message.text}</ReactMarkdown></Box>
                )}
                <Text fontSize="xs" color={message.sender === 'user' ? 'whiteAlpha.800' : 'gray.500'} mt={2} textAlign="right">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {message.sender === 'bot' && message.id !== 'welcome' && <FeedbackSection message={message} />}
              </Box>
            </Flex>
          ))}
          {isLoading && (
            <Flex justify="flex-start">
              <Box maxW={{ base: "85%", md: "70%" }} bg={botBubbleBg} p={4} borderRadius="lg" boxShadow="md" borderWidth={1} borderColor={botBubbleBorder}>
                <HStack spacing={2}>
                  <Spinner size="sm" color="brand.500" speed="0.8s" />
                  <Text color="gray.500" fontStyle="italic">Thinking...</Text>
                </HStack>
              </Box>
            </Flex>
          )}
          <div ref={messagesEndRef} />
        </VStack>
      )}

      {/* Input Area */}
      <Box p={4} borderTopWidth={1} bg="white">
        {embeddingsStatus.error && <Text color="orange.500" mb={2} fontSize="sm">Note: Advanced search is unavailable. Using traditional search instead.</Text>}

        {/* Uploaded document indicator */}
        {uploadedDoc && (
          <HStack mb={2} p={2} bg="green.50" borderRadius="md" borderWidth={1} borderColor="green.200" spacing={2}>
            <Text fontSize="sm">📄</Text>
            <Text fontSize="sm" color="green.700" fontWeight="medium" flex={1} noOfLines={1}>
              {uploadedDoc.label}: {uploadedDoc.filename}
            </Text>
            <Badge colorScheme="green" fontSize="xs">{uploadedDoc.label}</Badge>
            <Tooltip label="Remove document" placement="top" hasArrow>
              <IconButton aria-label="Remove document" icon={<span style={{ fontSize: '14px' }}>✕</span>} size="xs" variant="ghost" colorScheme="red" onClick={removeDocument} />
            </Tooltip>
          </HStack>
        )}

        <form onSubmit={handleSendMessage}>
          <HStack spacing={2}>
            {/* Hidden file input — accepts PDFs and images */}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/tiff,image/bmp,image/gif"
              ref={docInputRef}
              style={{ display: 'none' }}
              onChange={handleDocUpload}
            />
            <Tooltip label={uploadedDoc ? 'Replace uploaded document' : 'Upload a document (transcript, report card, schedule — PDF or photo)'} placement="top" hasArrow>
              <IconButton
                aria-label="Upload document"
                icon={isUploadingDoc ? <Spinner size="sm" /> : <span style={{ fontSize: '20px' }}>📎</span>}
                size="lg"
                variant="ghost"
                colorScheme={uploadedDoc ? 'green' : 'gray'}
                onClick={() => docInputRef.current?.click()}
                isDisabled={isUploadingDoc || !isInitialized}
              />
            </Tooltip>
            <InputGroup size="lg" flex={1}>
              <Input value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder={uploadedDoc ? "Ask about your courses, what to take next..." : "Ask about courses, requirements, or recommendations..."} disabled={isLoading || !isInitialized} pr="4.5rem" focusBorderColor="brand.500" borderRadius="md" boxShadow="sm" _hover={{ borderColor: 'brand.300' }} />
              <InputRightElement width="4.5rem">
                <Button h="1.75rem" size="sm" type="submit" colorScheme="brand" disabled={isLoading || !isInitialized || !inputMessage.trim()} borderRadius="md">Send</Button>
              </InputRightElement>
            </InputGroup>
          </HStack>
        </form>
      </Box>
    </Box>
  );
};

export default ChatInterface;
