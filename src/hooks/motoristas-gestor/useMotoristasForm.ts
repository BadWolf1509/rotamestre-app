/**
 * Form State Hook for Motoristas Management
 *
 * Handles form state, validation, and form-related callbacks.
 */

import { useState, useCallback } from 'react';

import { maskPhone, validatePhone, getPhoneErrorMessage } from '@/lib/phone';

export interface MotoristasFormState {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  emailError: string;
  telefoneError: string;
}

export interface UseMotoristasFormReturn {
  // Form state
  formNome: string;
  formEmail: string;
  formTelefone: string;
  formSenha: string;
  emailError: string;
  telefoneError: string;

  // Form setters
  setFormNome: (value: string) => void;
  setFormEmail: (value: string) => void;
  setFormTelefone: (value: string) => void;
  setFormSenha: (value: string) => void;

  // Form actions
  resetFormulario: () => void;
  validateEmail: (email: string) => boolean;
  handleTelefoneChange: (text: string) => void;
  validateForm: (requirePassword?: boolean) => { valid: boolean; message?: string };

  // Prefill form for editing
  prefillForm: (data: { nome: string; email: string; telefone?: string }) => void;
}

export function useMotoristasForm(): UseMotoristasFormReturn {
  // Form state
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formSenha, setFormSenha] = useState('');

  // Validation state
  const [emailError, setEmailError] = useState('');
  const [telefoneError, setTelefoneError] = useState('');

  // Reset form to initial state
  const resetFormulario = useCallback(() => {
    setFormNome('');
    setFormEmail('');
    setFormTelefone('');
    setFormSenha('');
    setEmailError('');
    setTelefoneError('');
  }, []);

  // Validate email field
  const validateEmail = useCallback((email: string): boolean => {
    setEmailError('');
    if (!email.trim()) return true;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError('Digite um email válido');
      return false;
    }
    return true;
  }, []);

  // Handle phone input with mask
  const handleTelefoneChange = useCallback((text: string) => {
    const formatted = maskPhone(text);
    setFormTelefone(formatted);

    if (text.length > 0) {
      const error = getPhoneErrorMessage(formatted);
      setTelefoneError(error || '');
    } else {
      setTelefoneError('');
    }
  }, []);

  // Validate entire form
  const validateForm = useCallback(
    (requirePassword = true): { valid: boolean; message?: string } => {
      // Validate required fields
      if (!formNome.trim() || !formEmail.trim()) {
        return { valid: false, message: 'Preencha todos os campos obrigatórios' };
      }

      if (requirePassword && !formSenha.trim()) {
        return { valid: false, message: 'Preencha todos os campos obrigatórios' };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formEmail.trim())) {
        return { valid: false, message: 'Digite um email válido' };
      }

      // Validate phone if filled
      if (formTelefone && !validatePhone(formTelefone)) {
        return { valid: false, message: 'Telefone inválido' };
      }

      return { valid: true };
    },
    [formNome, formEmail, formTelefone, formSenha]
  );

  // Prefill form for editing
  const prefillForm = useCallback(
    (data: { nome: string; email: string; telefone?: string }) => {
      setFormNome(data.nome);
      setFormEmail(data.email);
      setFormTelefone(data.telefone || '');
      setFormSenha('');
      setEmailError('');
      setTelefoneError('');
    },
    []
  );

  return {
    // Form state
    formNome,
    formEmail,
    formTelefone,
    formSenha,
    emailError,
    telefoneError,

    // Form setters
    setFormNome,
    setFormEmail,
    setFormTelefone,
    setFormSenha,

    // Form actions
    resetFormulario,
    validateEmail,
    handleTelefoneChange,
    validateForm,
    prefillForm,
  };
}
