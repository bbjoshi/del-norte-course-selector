import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  // Basic smoke test - App renders without throwing
  const { container } = render(<App />);
  expect(container).toBeTruthy();
});
