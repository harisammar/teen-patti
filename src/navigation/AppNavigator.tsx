import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../utils/constants';

// Screens
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import CreateRoomScreen from '../screens/CreateRoomScreen';
import JoinRoomScreen from '../screens/JoinRoomScreen';
import RoomLobbyScreen from '../screens/RoomLobbyScreen';
import GameScreen from '../screens/GameScreen';
import SpectatorScreen from '../screens/SpectatorScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FriendsScreen from '../screens/FriendsScreen';

// Route parameter types for type-safe navigation
export type RootStackParamList = {
  Auth: undefined;
  ProfileSetup: undefined;
  Home: undefined;
  CreateRoom: undefined;
  JoinRoom: undefined;
  RoomLobby: { roomId: string };
  Game: { roomId: string; gameId: string };
  Spectator: { roomId: string; gameId: string };
  Leaderboard: undefined;
  Profile: undefined;
  Friends: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: COLORS.tableGreen },
  headerTintColor: COLORS.gold,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 18 },
  contentStyle: { backgroundColor: COLORS.background },
  animation: 'slide_from_right' as const,
};

export default function AppNavigator() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: COLORS.gold,
          background: COLORS.background,
          card: COLORS.tableGreen,
          text: COLORS.white,
          border: COLORS.border,
          notification: COLORS.danger,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          // Auth stack — unauthenticated users
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        ) : user.profileComplete === false ? (
          // New user (phone sign-up) — must complete profile before entering the app
          <Stack.Screen
            name="ProfileSetup"
            component={ProfileSetupScreen}
            options={{ headerShown: false }}
          />
        ) : (
          // Main app stack — authenticated users with complete profile
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: '♠ Teen Patti', headerShown: false }}
            />
            <Stack.Screen
              name="CreateRoom"
              component={CreateRoomScreen}
              options={{ title: 'Create Room' }}
            />
            <Stack.Screen
              name="JoinRoom"
              component={JoinRoomScreen}
              options={{ title: 'Join Room' }}
            />
            <Stack.Screen
              name="RoomLobby"
              component={RoomLobbyScreen}
              options={{ title: 'Room Lobby', headerBackTitle: 'Leave' }}
            />
            <Stack.Screen
              name="Game"
              component={GameScreen}
              options={{ title: 'Teen Patti', headerShown: false }}
            />
            <Stack.Screen
              name="Spectator"
              component={SpectatorScreen}
              options={{ title: 'Spectating' }}
            />
            <Stack.Screen
              name="Leaderboard"
              component={LeaderboardScreen}
              options={{ title: '🏆 Leaderboard' }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'My Profile' }}
            />
            <Stack.Screen
              name="Friends"
              component={FriendsScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
