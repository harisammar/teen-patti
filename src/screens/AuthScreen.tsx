import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { ConfirmationResult } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { COLORS, AVATARS } from '../utils/constants';
import firebaseConfig from '../services/firebase';

type Tab = 'signIn' | 'signUp' | 'phone';

export default function AuthScreen() {
  const { signIn, signUp, sendPhoneOtp, confirmPhoneOtp, isLoading } = useAuth();

  const [tab, setTab] = useState<Tab>('signIn');

  // ---- Email fields ----
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---- Phone fields ----
  const recaptchaVerifier = useRef<any>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [phoneStep, setPhoneStep] = useState<'number' | 'otp'>('number');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // ---- Email validation ----
  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (tab === 'signUp' && name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    }
    if (!email.includes('@') || !email.includes('.')) {
      newErrors.email = 'Enter a valid email address.';
    }
    if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleEmailSubmit() {
    if (!validate()) return;
    try {
      if (tab === 'signIn') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, name.trim(), selectedAvatar);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      Alert.alert('Error', message);
    }
  }

  // ---- Phone auth step 1: send OTP ----
  async function handleSendOtp() {
    const cleaned = phone.trim();
    if (!/^\+\d{7,15}$/.test(cleaned)) {
      setPhoneError('Enter a valid number with country code, e.g. +919876543210');
      return;
    }
    setPhoneError('');
    setPhoneBusy(true);
    try {
      const result = await sendPhoneOtp(cleaned, recaptchaVerifier.current);
      setConfirmation(result);
      setPhoneStep('otp');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send OTP.';
      setPhoneError(msg);
    } finally {
      setPhoneBusy(false);
    }
  }

  // ---- Phone auth step 2: verify OTP ----
  async function handleVerifyOtp() {
    if (!confirmation) return;
    if (otp.trim().length < 4) {
      setPhoneError('Enter the OTP sent to your phone.');
      return;
    }
    setPhoneError('');
    setPhoneBusy(true);
    try {
      await confirmPhoneOtp(confirmation, otp.trim());
      // AppNavigator handles routing: new users → ProfileSetup, existing → Home
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid OTP. Please try again.';
      setPhoneError(msg);
    } finally {
      setPhoneBusy(false);
    }
  }

  function resetPhoneTab() {
    setPhone('');
    setOtp('');
    setConfirmation(null);
    setPhoneStep('number');
    setPhoneError('');
  }

  function switchTab(t: Tab) {
    setTab(t);
    setErrors({});
    resetPhoneTab();
  }

  return (
    <LinearGradient colors={['#0d2b1a', '#1a4a2e', '#0d2b1a']} style={styles.gradient}>
      {/* reCAPTCHA modal — must be in tree even when not visible */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={false}
      />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.cardSymbols}>♠ ♥ ♦ ♣</Text>
              <Text style={styles.title}>Teen Patti</Text>
              <Text style={styles.subtitle}>The Classic Card Game</Text>
            </View>

            {/* Tab switcher */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, tab === 'signIn' && styles.tabActive]}
                onPress={() => switchTab('signIn')}
              >
                <Text style={[styles.tabText, tab === 'signIn' && styles.tabTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'signUp' && styles.tabActive]}
                onPress={() => switchTab('signUp')}
              >
                <Text style={[styles.tabText, tab === 'signUp' && styles.tabTextActive]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'phone' && styles.tabActive]}
                onPress={() => switchTab('phone')}
              >
                <Text style={[styles.tabText, tab === 'phone' && styles.tabTextActive]}>
                  📱 Phone
                </Text>
              </TouchableOpacity>
            </View>

            {/* ---- Email / Sign In / Sign Up form ---- */}
            {(tab === 'signIn' || tab === 'signUp') && (
              <View style={styles.card}>
                {/* Name (sign up only) */}
                {tab === 'signUp' && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Display Name</Text>
                    <TextInput
                      style={[styles.input, errors.name ? styles.inputError : null]}
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name at the table"
                      placeholderTextColor={COLORS.textMuted}
                      autoCorrect={false}
                      maxLength={24}
                    />
                    {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
                  </View>
                )}

                {/* Email */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={[styles.input, errors.email ? styles.inputError : null]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={[styles.input, errors.password ? styles.inputError : null]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Min 6 characters"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                  />
                  {errors.password ? (
                    <Text style={styles.errorText}>{errors.password}</Text>
                  ) : null}
                </View>

                {/* Avatar picker (sign up only) */}
                {tab === 'signUp' && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Choose Avatar</Text>
                    <View style={styles.avatarRow}>
                      {AVATARS.map((avatar) => (
                        <TouchableOpacity
                          key={avatar}
                          style={[
                            styles.avatarBtn,
                            selectedAvatar === avatar && styles.avatarBtnSelected,
                          ]}
                          onPress={() => setSelectedAvatar(avatar)}
                        >
                          <Text style={styles.avatarEmoji}>{avatar}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Submit button */}
                <TouchableOpacity
                  style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                  onPress={handleEmailSubmit}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.background} />
                  ) : (
                    <Text style={styles.submitText}>
                      {tab === 'signIn' ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ---- Phone OTP form ---- */}
            {tab === 'phone' && (
              <View style={styles.card}>
                {phoneStep === 'number' ? (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Phone Number</Text>
                      <TextInput
                        style={[styles.input, phoneError ? styles.inputError : null]}
                        value={phone}
                        onChangeText={(t) => { setPhone(t); setPhoneError(''); }}
                        placeholder="+919876543210"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="phone-pad"
                        autoCorrect={false}
                        maxLength={16}
                      />
                      <Text style={styles.hintText}>Include country code, e.g. +91 for India</Text>
                      {phoneError ? (
                        <Text style={styles.errorText}>{phoneError}</Text>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={[styles.submitBtn, phoneBusy && styles.submitBtnDisabled]}
                      onPress={handleSendOtp}
                      disabled={phoneBusy}
                      activeOpacity={0.85}
                    >
                      {phoneBusy ? (
                        <ActivityIndicator color={COLORS.background} />
                      ) : (
                        <Text style={styles.submitText}>Send OTP</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.otpHeader}>
                      <Text style={styles.otpTitle}>Enter OTP</Text>
                      <Text style={styles.otpSubtitle}>Sent to {phone}</Text>
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>One-Time Password</Text>
                      <TextInput
                        style={[styles.input, styles.otpInput, phoneError ? styles.inputError : null]}
                        value={otp}
                        onChangeText={(t) => { setOtp(t); setPhoneError(''); }}
                        placeholder="------"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="number-pad"
                        maxLength={8}
                        autoFocus
                      />
                      {phoneError ? (
                        <Text style={styles.errorText}>{phoneError}</Text>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={[styles.submitBtn, phoneBusy && styles.submitBtnDisabled]}
                      onPress={handleVerifyOtp}
                      disabled={phoneBusy}
                      activeOpacity={0.85}
                    >
                      {phoneBusy ? (
                        <ActivityIndicator color={COLORS.background} />
                      ) : (
                        <Text style={styles.submitText}>Verify & Sign In</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.backLink}
                      onPress={() => {
                        setPhoneStep('number');
                        setOtp('');
                        setPhoneError('');
                      }}
                    >
                      <Text style={styles.backLinkText}>← Change number</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  cardSymbols: {
    fontSize: 28,
    color: COLORS.gold,
    letterSpacing: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    letterSpacing: 1,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: COLORS.tableGreen },
  tabText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldGroup: { marginBottom: 16 },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.white,
    fontSize: 16,
  },
  otpInput: {
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 16,
  },
  inputError: { borderColor: COLORS.danger },
  errorText: { color: COLORS.danger, fontSize: 12, marginTop: 4 },
  hintText: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.inputBg,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBtnSelected: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.tableGreen,
  },
  avatarEmoji: { fontSize: 24 },
  submitBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    color: COLORS.background,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Phone OTP specific
  otpHeader: { alignItems: 'center', marginBottom: 20 },
  otpTitle: { color: COLORS.white, fontSize: 20, fontWeight: '700' },
  otpSubtitle: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  backLink: { alignItems: 'center', marginTop: 16 },
  backLinkText: { color: COLORS.gold, fontSize: 14 },
});
