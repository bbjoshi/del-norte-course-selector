#!/bin/bash

# Kill any existing server running on port 3003
echo "Checking for existing server on port 3003..."
if lsof -i :3003 -t &> /dev/null; then
  echo "Found existing server. Killing it..."
  lsof -i :3003 -t | xargs kill -9
  echo "Existing server killed."
  # Wait a moment to ensure the port is released
  sleep 2
fi

# Start a new server instance
echo "Starting a new server instance..."
cd "$(dirname "$0")" # Ensure we're in the project directory
npm start &
SERVER_PID=$!

# Wait for the server to start
echo "Waiting for server to start..."
MAX_ATTEMPTS=30
ATTEMPTS=0
while ! curl -s http://localhost:3003/health > /dev/null && [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  echo "Waiting for server to become available... ($(($ATTEMPTS+1))/$MAX_ATTEMPTS)"
  sleep 1
  ATTEMPTS=$((ATTEMPTS+1))
done

# Check if server started successfully
if ! curl -s http://localhost:3003/health > /dev/null; then
  echo "ERROR: Failed to start server after $MAX_ATTEMPTS attempts."
  echo "Exiting..."
  exit 1
fi

echo "Server started successfully."

# Check if OpenRouter API key is set
if ! grep -q "REACT_APP_OPENROUTER_API_KEY" .env; then
  echo "WARNING: OpenRouter API key might not be set in .env file."
  echo "Vector embeddings generation requires a valid API key."
  echo "Please check your .env file before proceeding."
  read -p "Continue anyway? (y/n): " continue_choice
  if [[ $continue_choice != "y" && $continue_choice != "Y" ]]; then
    echo "Exiting..."
    exit 1
  fi
fi

# Clear previous log if it exists
if [ -f embeddings-test-log.txt ]; then
  echo "Removing previous test log..."
  rm embeddings-test-log.txt
fi

# Run the embeddings test and save output to a log file
echo "Running embeddings test..."
echo "This may take several minutes. Please be patient..."
echo "-----------------------------------------------"
node test-embeddings.js | tee embeddings-test-log.txt

# Check if the test completed successfully
if [ $? -ne 0 ]; then
  echo ""
  echo "ERROR: The test script encountered an error."
  echo "Please check embeddings-test-log.txt for details."
  exit 1
fi

echo ""
echo "-----------------------------------------------"
echo "Test completed. Results saved to embeddings-test-log.txt"
echo ""
echo "Summary of vector search status:"
grep -A 2 "SUCCESS\|FAILURE\|IN PROGRESS\|UNKNOWN" embeddings-test-log.txt

echo ""
echo "Vector search success rate:"
grep "Vector search success rate" embeddings-test-log.txt

echo ""
echo "If vector search is not working correctly, check:"
echo "1. OpenRouter API key in .env file"
echo "2. Server logs for any errors"
echo "3. Network connectivity to OpenRouter API"
echo "4. Model availability ('openai/text-embedding-3-small')"
echo ""
echo "To fix issues, you may need to:"
echo "1. Restart the server"
echo "2. Clear any cached data"
echo "3. Update the API key if it has expired"
echo "4. Check for rate limiting on the OpenRouter API"

# Kill the server we started
echo ""
echo "Cleaning up: Killing the server process..."
if [ -n "$SERVER_PID" ]; then
  kill -9 $SERVER_PID 2>/dev/null || true
  echo "Server process killed."
else
  # If SERVER_PID is not set, try to find and kill the process by port
  if lsof -i :3003 -t &> /dev/null; then
    lsof -i :3003 -t | xargs kill -9
    echo "Server process killed."
  fi
fi
