import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Storyboard Generator heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/Storyboard Generator/i);
  expect(headingElement).toBeInTheDocument();
});

test('renders textarea', () => {
  render(<App />);
  const textareaElement = screen.getByRole('textbox');
  expect(textareaElement).toBeInTheDocument();
});

test('renders Generate Storyboard button', () => {
  render(<App />);
  const buttonElement = screen.getByRole('button', { name: /Generate Storyboard/i });
  expect(buttonElement).toBeInTheDocument();
});
