# Roamio

A wellness travel companion app built with React Native and Expo.

## Project Structure

- `mobile/` - React Native Expo app
- `backend/` - Supabase functions and API
- `frontend/` - Legacy Next.js web app

## Getting Started with Mobile App

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Use Expo Go app on your phone to scan the QR code and run the app.

## Features

- Trip planning and itinerary management
- Real-time energy check-ins
- AI-powered activity suggestions based on energy levels
- Location-based services
- Offline-capable with sync

## Tech Stack

- **Mobile**: React Native, Expo, Expo Router
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **Backend**: Supabase (functions, database)
- **AI**: Gemini integration for activity suggestions
