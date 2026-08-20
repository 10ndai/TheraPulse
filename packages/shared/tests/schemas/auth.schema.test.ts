import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../../src/schemas/auth.schema';

describe('registerSchema', () => {
  it('rejects emails without @ symbol', () => {
    const result = registerSchema.safeParse({
      email: 'notanemail',
      password: 'ValidPass123!',
      role: 'CLIENT',
    });
    expect(result.success).toBe(false);
  });

  it('rejects passwords shorter than 12 characters', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'Short1!',
      role: 'CLIENT',
    });
    expect(result.success).toBe(false);
  });

  it('rejects passwords without an uppercase letter', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'validpassword1!',
      role: 'CLIENT',
    });
    expect(result.success).toBe(false);
  });

  it('rejects passwords without a number', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'ValidPassword!',
      role: 'CLIENT',
    });
    expect(result.success).toBe(false);
  });

  it('rejects passwords without a special character', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'ValidPassword1',
      role: 'CLIENT',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid CLIENT registration', () => {
    const result = registerSchema.safeParse({
      email: 'client@example.com',
      password: 'SecurePass123!',
      role: 'CLIENT',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid THERAPIST registration', () => {
    const result = registerSchema.safeParse({
      email: 'therapist@example.com',
      password: 'SecurePass123!',
      role: 'THERAPIST',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown roles', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'SecurePass123!',
      role: 'SUPERADMIN',
    });
    expect(result.success).toBe(false);
  });

  it('rejects passwords with fewer than 12 chars even if all rules met', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'Ab1!efghij',
      role: 'CLIENT',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('rejects empty email', () => {
    const result = loginSchema.safeParse({
      email: '',
      password: 'SecurePass123!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = loginSchema.safeParse({
      email: 'notvalid',
      password: 'SecurePass123!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid login credentials', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });
});
