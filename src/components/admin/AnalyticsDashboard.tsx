import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Spinner,
  Center,
  Button,
  Icon,
  Divider,
  Progress,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useColorModeValue,
  Tooltip,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { FiRefreshCw, FiUsers, FiMessageSquare, FiClock, FiActivity, FiThumbsUp, FiThumbsDown, FiBarChart2 } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface AnalyticsData {
  accounts: {
    total: number;
    signupsByDay: { day: string; count: number }[];
  };
  questions: {
    total: number;
    byDay: { day: string; count: number }[];
    uniqueUsers: number;
  };
  answers: {
    total: number;
  };
  chatSessions: {
    total: number;
  };
  userSessions: {
    total: number;
    avgDurationSeconds: number;
    maxDurationSeconds: number;
    avgQuestionsPerSession: number;
    durationDistribution: { duration_bucket: string; count: number }[];
  };
  activeUsers: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  logins: {
    total: number;
  };
  feedback: {
    total: number;
    positive: number;
    negative: number;
  };
  topUsersByQuestions: { user_email: string; user_id: string; question_count: number }[];
  recentEvents: {
    id: number;
    event_type: string;
    user_email: string | null;
    session_id: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
  }[];
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
};

const formatEventType = (eventType: string): string => {
  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const eventTypeColor = (eventType: string): string => {
  switch (eventType) {
    case 'account_created': return 'green';
    case 'login': return 'blue';
    case 'logout': return 'gray';
    case 'question_asked': return 'purple';
    case 'answer_received': return 'teal';
    case 'feedback_submitted': return 'orange';
    case 'chat_session_started': return 'cyan';
    case 'page_view': return 'pink';
    default: return 'gray';
  }
};

const AnalyticsDashboard: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const cardBg = useColorModeValue('white', 'gray.700');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/admin/analytics');
      if (response.data.success) {
        setAnalytics(response.data.analytics);
        setLastRefresh(new Date());
      } else {
        setError('Failed to load analytics data');
      }
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.response?.data?.details || err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchAnalytics();
  }, [isAdmin, navigate, fetchAnalytics]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  if (!isAdmin) return null;

  if (loading && !analytics) {
    return (
      <Center py={20}>
        <VStack spacing={4}>
          <Spinner size="xl" color="brand.500" thickness="4px" />
          <Text color="gray.500">Loading analytics...</Text>
        </VStack>
      </Center>
    );
  }

  if (error && !analytics) {
    return (
      <Box py={8}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Text>{error}</Text>
          <Button ml={4} size="sm" onClick={fetchAnalytics}>Retry</Button>
        </Alert>
      </Box>
    );
  }

  if (!analytics) return null;

  const feedbackRate = analytics.feedback.total > 0
    ? Math.round((analytics.feedback.positive / analytics.feedback.total) * 100)
    : 0;

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <HStack justify="space-between" align="center">
        <Box>
          <Heading size="md">
            <Icon as={FiBarChart2} mr={2} />
            Usage Analytics
          </Heading>
          <Text fontSize="sm" color="gray.500" mt={1}>
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </Text>
        </Box>
        <Button
          leftIcon={<FiRefreshCw />}
          size="sm"
          variant="outline"
          onClick={fetchAnalytics}
          isLoading={loading}
        >
          Refresh
        </Button>
      </HStack>

      {error && (
        <Alert status="warning" borderRadius="md" size="sm">
          <AlertIcon />
          <Text fontSize="sm">{error}</Text>
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <Card bg={cardBg} boxShadow="sm">
          <CardBody p={4}>
            <Stat>
              <StatLabel>
                <HStack spacing={1}>
                  <Icon as={FiUsers} color="green.500" />
                  <Text>Accounts Created</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="2xl">{analytics.accounts.total}</StatNumber>
              <StatHelpText>{analytics.logins.total} total logins</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={cardBg} boxShadow="sm">
          <CardBody p={4}>
            <Stat>
              <StatLabel>
                <HStack spacing={1}>
                  <Icon as={FiMessageSquare} color="purple.500" />
                  <Text>Questions Asked</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="2xl">{analytics.questions.total}</StatNumber>
              <StatHelpText>{analytics.answers.total} answers given</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={cardBg} boxShadow="sm">
          <CardBody p={4}>
            <Stat>
              <StatLabel>
                <HStack spacing={1}>
                  <Icon as={FiClock} color="blue.500" />
                  <Text>Avg Session Duration</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="2xl">
                {formatDuration(analytics.userSessions.avgDurationSeconds)}
              </StatNumber>
              <StatHelpText>{analytics.userSessions.total} sessions</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card bg={cardBg} boxShadow="sm">
          <CardBody p={4}>
            <Stat>
              <StatLabel>
                <HStack spacing={1}>
                  <Icon as={FiActivity} color="orange.500" />
                  <Text>Active Users</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="2xl">{analytics.activeUsers.today}</StatNumber>
              <StatHelpText>Today ({analytics.activeUsers.thisWeek} this week)</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Detailed Tabs */}
      <Tabs variant="enclosed" colorScheme="brand">
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Users</Tab>
          <Tab>Sessions</Tab>
          <Tab>Activity Log</Tab>
        </TabList>

        <TabPanels>
          {/* Overview Tab */}
          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {/* Active Users Card */}
              <Card bg={cardBg} boxShadow="sm">
                <CardHeader pb={2}>
                  <Heading size="sm">Active Users</Heading>
                </CardHeader>
                <CardBody pt={2}>
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text fontSize="sm">Today</Text>
                      <Badge colorScheme="green" fontSize="md" px={3} py={1}>{analytics.activeUsers.today}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm">This Week</Text>
                      <Badge colorScheme="blue" fontSize="md" px={3} py={1}>{analytics.activeUsers.thisWeek}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm">This Month</Text>
                      <Badge colorScheme="purple" fontSize="md" px={3} py={1}>{analytics.activeUsers.thisMonth}</Badge>
                    </HStack>
                    <Divider />
                    <HStack justify="space-between">
                      <Text fontSize="sm">Chat Sessions</Text>
                      <Badge colorScheme="gray" fontSize="md" px={3} py={1}>{analytics.chatSessions.total}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm">Unique Questioners</Text>
                      <Badge colorScheme="orange" fontSize="md" px={3} py={1}>{analytics.questions.uniqueUsers}</Badge>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>

              {/* Feedback Card */}
              <Card bg={cardBg} boxShadow="sm">
                <CardHeader pb={2}>
                  <Heading size="sm">Feedback Summary</Heading>
                </CardHeader>
                <CardBody pt={2}>
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <HStack>
                        <Icon as={FiThumbsUp} color="green.500" />
                        <Text fontSize="sm">Positive</Text>
                      </HStack>
                      <Badge colorScheme="green" fontSize="md" px={3} py={1}>{analytics.feedback.positive || 0}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <HStack>
                        <Icon as={FiThumbsDown} color="red.500" />
                        <Text fontSize="sm">Negative</Text>
                      </HStack>
                      <Badge colorScheme="red" fontSize="md" px={3} py={1}>{analytics.feedback.negative || 0}</Badge>
                    </HStack>
                    <Divider />
                    <Box>
                      <HStack justify="space-between" mb={1}>
                        <Text fontSize="sm">Satisfaction Rate</Text>
                        <Text fontSize="sm" fontWeight="bold" color={feedbackRate >= 70 ? 'green.500' : feedbackRate >= 50 ? 'yellow.500' : 'red.500'}>
                          {feedbackRate}%
                        </Text>
                      </HStack>
                      <Progress
                        value={feedbackRate}
                        colorScheme={feedbackRate >= 70 ? 'green' : feedbackRate >= 50 ? 'yellow' : 'red'}
                        size="sm"
                        borderRadius="full"
                      />
                    </Box>
                    <Text fontSize="xs" color="gray.500">
                      Based on {analytics.feedback.total || 0} total feedback submissions
                    </Text>
                  </VStack>
                </CardBody>
              </Card>

              {/* Questions Per Day (last 7 days) */}
              <Card bg={cardBg} boxShadow="sm" gridColumn={{ md: 'span 2' }}>
                <CardHeader pb={2}>
                  <Heading size="sm">Questions Per Day (Last 30 Days)</Heading>
                </CardHeader>
                <CardBody pt={2}>
                  {analytics.questions.byDay.length === 0 ? (
                    <Text color="gray.500" fontSize="sm">No question data yet</Text>
                  ) : (
                    <Box overflowX="auto">
                      <HStack spacing={1} align="end" minH="100px" justify="flex-start">
                        {analytics.questions.byDay.slice(-30).map((day) => {
                          const maxCount = Math.max(...analytics.questions.byDay.map(d => d.count), 1);
                          const heightPct = Math.max((day.count / maxCount) * 100, 4);
                          return (
                            <Tooltip key={day.day} label={`${day.day}: ${day.count} questions`} placement="top">
                              <Box
                                w="20px"
                                minW="12px"
                                h={`${heightPct}px`}
                                bg="purple.400"
                                borderRadius="sm"
                                cursor="pointer"
                                _hover={{ bg: 'purple.600' }}
                              />
                            </Tooltip>
                          );
                        })}
                      </HStack>
                      <HStack justify="space-between" mt={2}>
                        <Text fontSize="xs" color="gray.500">
                          {analytics.questions.byDay.length > 0 ? analytics.questions.byDay[0].day : ''}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {analytics.questions.byDay.length > 0 ? analytics.questions.byDay[analytics.questions.byDay.length - 1].day : ''}
                        </Text>
                      </HStack>
                    </Box>
                  )}
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          {/* Users Tab */}
          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {/* Signups Over Time */}
              <Card bg={cardBg} boxShadow="sm">
                <CardHeader pb={2}>
                  <Heading size="sm">Signups (Last 30 Days)</Heading>
                </CardHeader>
                <CardBody pt={2}>
                  {analytics.accounts.signupsByDay.length === 0 ? (
                    <Text color="gray.500" fontSize="sm">No signup data yet</Text>
                  ) : (
                    <Box overflowX="auto">
                      <HStack spacing={1} align="end" minH="80px">
                        {analytics.accounts.signupsByDay.map((day) => {
                          const maxCount = Math.max(...analytics.accounts.signupsByDay.map(d => d.count), 1);
                          const heightPct = Math.max((day.count / maxCount) * 100, 4);
                          return (
                            <Tooltip key={day.day} label={`${day.day}: ${day.count} signups`} placement="top">
                              <Box
                                w="20px"
                                minW="12px"
                                h={`${heightPct}px`}
                                bg="green.400"
                                borderRadius="sm"
                                cursor="pointer"
                                _hover={{ bg: 'green.600' }}
                              />
                            </Tooltip>
                          );
                        })}
                      </HStack>
                    </Box>
                  )}
                </CardBody>
              </Card>

              {/* Top Users */}
              <Card bg={cardBg} boxShadow="sm">
                <CardHeader pb={2}>
                  <Heading size="sm">Top Users by Questions</Heading>
                </CardHeader>
                <CardBody pt={2}>
                  {analytics.topUsersByQuestions.length === 0 ? (
                    <Text color="gray.500" fontSize="sm">No user data yet</Text>
                  ) : (
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>User</Th>
                          <Th isNumeric>Questions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {analytics.topUsersByQuestions.map((user, idx) => (
                          <Tr key={user.user_id}>
                            <Td>
                              <HStack>
                                <Badge colorScheme={idx < 3 ? 'gold' : 'gray'} variant="subtle" fontSize="xs">
                                  #{idx + 1}
                                </Badge>
                                <Text fontSize="sm" noOfLines={1}>
                                  {user.user_email || user.user_id?.substring(0, 12) + '...'}
                                </Text>
                              </HStack>
                            </Td>
                            <Td isNumeric>
                              <Badge colorScheme="purple">{user.question_count}</Badge>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  )}
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          {/* Sessions Tab */}
          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {/* Session Stats */}
              <Card bg={cardBg} boxShadow="sm">
                <CardHeader pb={2}>
                  <Heading size="sm">Session Statistics</Heading>
                </CardHeader>
                <CardBody pt={2}>
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text fontSize="sm">Total App Sessions</Text>
                      <Badge colorScheme="blue" fontSize="md" px={3} py={1}>{analytics.userSessions.total}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm">Average Duration</Text>
                      <Badge colorScheme="purple" fontSize="md" px={3} py={1}>
                        {formatDuration(analytics.userSessions.avgDurationSeconds)}
                      </Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm">Longest Session</Text>
                      <Badge colorScheme="orange" fontSize="md" px={3} py={1}>
                        {formatDuration(analytics.userSessions.maxDurationSeconds)}
                      </Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm">Avg Questions/Session</Text>
                      <Badge colorScheme="teal" fontSize="md" px={3} py={1}>
                        {analytics.userSessions.avgQuestionsPerSession}
                      </Badge>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>

              {/* Duration Distribution */}
              <Card bg={cardBg} boxShadow="sm">
                <CardHeader pb={2}>
                  <Heading size="sm">Session Duration Distribution</Heading>
                </CardHeader>
                <CardBody pt={2}>
                  {analytics.userSessions.durationDistribution.length === 0 ? (
                    <Text color="gray.500" fontSize="sm">No session data yet</Text>
                  ) : (
                    <VStack spacing={2} align="stretch">
                      {analytics.userSessions.durationDistribution.map((bucket) => {
                        const maxCount = Math.max(...analytics.userSessions.durationDistribution.map(b => b.count), 1);
                        const pct = (bucket.count / maxCount) * 100;
                        return (
                          <Box key={bucket.duration_bucket}>
                            <HStack justify="space-between" mb={1}>
                              <Text fontSize="sm">{bucket.duration_bucket}</Text>
                              <Text fontSize="sm" fontWeight="bold">{bucket.count}</Text>
                            </HStack>
                            <Progress value={pct} colorScheme="blue" size="sm" borderRadius="full" />
                          </Box>
                        );
                      })}
                    </VStack>
                  )}
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          {/* Activity Log Tab */}
          <TabPanel px={0}>
            <Card bg={cardBg} boxShadow="sm">
              <CardHeader pb={2}>
                <Heading size="sm">Recent Activity (Last 50 Events)</Heading>
              </CardHeader>
              <CardBody pt={2}>
                {analytics.recentEvents.length === 0 ? (
                  <Text color="gray.500" fontSize="sm">No events recorded yet</Text>
                ) : (
                  <Box overflowX="auto">
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Time</Th>
                          <Th>Event</Th>
                          <Th>User</Th>
                          <Th>Details</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {analytics.recentEvents.map((event) => (
                          <Tr key={event.id}>
                            <Td whiteSpace="nowrap">
                              <Text fontSize="xs" color="gray.500">
                                {new Date(event.created_at).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </Td>
                            <Td>
                              <Badge colorScheme={eventTypeColor(event.event_type)} fontSize="xs">
                                {formatEventType(event.event_type)}
                              </Badge>
                            </Td>
                            <Td>
                              <Text fontSize="xs" noOfLines={1} maxW="180px">
                                {event.user_email || '—'}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="xs" color="gray.500" noOfLines={1} maxW="200px">
                                {event.metadata
                                  ? Object.entries(event.metadata)
                                      .filter(([k]) => !['email', 'chatSessionId'].includes(k))
                                      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.substring(0, 40) : v}`)
                                      .join(', ')
                                  : '—'}
                              </Text>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
};

export default AnalyticsDashboard;
