/**
 * useMotoristasForm - Tests
 *
 * Tests form initialization, validation, reset, phone masking, and prefill (edit mode).
 */

import { renderHook, act } from "@testing-library/react-native";

import { maskPhone, getPhoneErrorMessage, validatePhone } from "@/lib/phone";

import { useMotoristasForm } from "../useMotoristasForm";

// Mock phone utilities
jest.mock("@/lib/phone", () => ({
  maskPhone: jest.fn((text: string) => text),
  validatePhone: jest.fn(
    (phone: string) => phone.replace(/\D/g, "").length >= 10,
  ),
  getPhoneErrorMessage: jest.fn((_phone: string) => null),
}));

describe("useMotoristasForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Initial state
  // ==========================================================================

  describe("initial state", () => {
    it("initializes with empty form fields", () => {
      const { result } = renderHook(() => useMotoristasForm());

      expect(result.current.formNome).toBe("");
      expect(result.current.formEmail).toBe("");
      expect(result.current.formTelefone).toBe("");
      expect(result.current.formSenha).toBe("");
    });

    it("initializes with no validation errors", () => {
      const { result } = renderHook(() => useMotoristasForm());

      expect(result.current.emailError).toBe("");
      expect(result.current.telefoneError).toBe("");
    });
  });

  // ==========================================================================
  // Form setters
  // ==========================================================================

  describe("form setters", () => {
    it("setFormNome updates nome", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormNome("João Silva");
      });

      expect(result.current.formNome).toBe("João Silva");
    });

    it("setFormEmail updates email", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormEmail("joao@test.com");
      });

      expect(result.current.formEmail).toBe("joao@test.com");
    });

    it("setFormTelefone updates telefone", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormTelefone("(11) 99999-9999");
      });

      expect(result.current.formTelefone).toBe("(11) 99999-9999");
    });

    it("setFormSenha updates senha", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormSenha("senha123");
      });

      expect(result.current.formSenha).toBe("senha123");
    });
  });

  // ==========================================================================
  // resetFormulario
  // ==========================================================================

  describe("resetFormulario", () => {
    it("clears all form fields", () => {
      const { result } = renderHook(() => useMotoristasForm());

      // Fill form
      act(() => {
        result.current.setFormNome("João");
        result.current.setFormEmail("joao@test.com");
        result.current.setFormTelefone("(11) 99999-9999");
        result.current.setFormSenha("senha123");
      });

      // Reset
      act(() => {
        result.current.resetFormulario();
      });

      expect(result.current.formNome).toBe("");
      expect(result.current.formEmail).toBe("");
      expect(result.current.formTelefone).toBe("");
      expect(result.current.formSenha).toBe("");
    });

    it("clears validation errors", () => {
      const { result } = renderHook(() => useMotoristasForm());

      // Trigger email error
      act(() => {
        result.current.validateEmail("invalid");
      });

      expect(result.current.emailError).toBe("Digite um email válido");

      // Reset
      act(() => {
        result.current.resetFormulario();
      });

      expect(result.current.emailError).toBe("");
      expect(result.current.telefoneError).toBe("");
    });
  });

  // ==========================================================================
  // validateEmail
  // ==========================================================================

  describe("validateEmail", () => {
    it("returns true for empty string (optional field)", () => {
      const { result } = renderHook(() => useMotoristasForm());

      let valid: boolean;
      act(() => {
        valid = result.current.validateEmail("");
      });

      expect(valid!).toBe(true);
      expect(result.current.emailError).toBe("");
    });

    it("returns true for whitespace-only (treated as empty)", () => {
      const { result } = renderHook(() => useMotoristasForm());

      let valid: boolean;
      act(() => {
        valid = result.current.validateEmail("   ");
      });

      expect(valid!).toBe(true);
    });

    it("returns true for valid email", () => {
      const { result } = renderHook(() => useMotoristasForm());

      let valid: boolean;
      act(() => {
        valid = result.current.validateEmail("user@example.com");
      });

      expect(valid!).toBe(true);
      expect(result.current.emailError).toBe("");
    });

    it("returns false and sets error for invalid email", () => {
      const { result } = renderHook(() => useMotoristasForm());

      let valid: boolean;
      act(() => {
        valid = result.current.validateEmail("not-an-email");
      });

      expect(valid!).toBe(false);
      expect(result.current.emailError).toBe("Digite um email válido");
    });

    it("returns false for email missing domain", () => {
      const { result } = renderHook(() => useMotoristasForm());

      let valid: boolean;
      act(() => {
        valid = result.current.validateEmail("user@");
      });

      expect(valid!).toBe(false);
      expect(result.current.emailError).toBe("Digite um email válido");
    });

    it("clears previous error when valid email is entered", () => {
      const { result } = renderHook(() => useMotoristasForm());

      // Set invalid
      act(() => {
        result.current.validateEmail("bad");
      });
      expect(result.current.emailError).toBe("Digite um email válido");

      // Now set valid
      act(() => {
        result.current.validateEmail("good@test.com");
      });
      expect(result.current.emailError).toBe("");
    });
  });

  // ==========================================================================
  // handleTelefoneChange
  // ==========================================================================

  describe("handleTelefoneChange", () => {
    it("applies phone mask via maskPhone", () => {
      (maskPhone as jest.Mock).mockReturnValue("(11) 9");

      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.handleTelefoneChange("119");
      });

      expect(maskPhone).toHaveBeenCalledWith("119");
      expect(result.current.formTelefone).toBe("(11) 9");
    });

    it("sets telefone error when getPhoneErrorMessage returns error", () => {
      (maskPhone as jest.Mock).mockReturnValue("(11) 9");
      (getPhoneErrorMessage as jest.Mock).mockReturnValue(
        "Telefone incompleto",
      );

      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.handleTelefoneChange("119");
      });

      expect(result.current.telefoneError).toBe("Telefone incompleto");
    });

    it("clears telefone error when phone is valid", () => {
      (maskPhone as jest.Mock).mockReturnValue("(11) 99999-9999");
      (getPhoneErrorMessage as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.handleTelefoneChange("11999999999");
      });

      expect(result.current.telefoneError).toBe("");
    });

    it("clears telefone error when input is empty", () => {
      (maskPhone as jest.Mock).mockReturnValue("");

      const { result } = renderHook(() => useMotoristasForm());

      // First set an error
      (getPhoneErrorMessage as jest.Mock).mockReturnValue(
        "Telefone incompleto",
      );
      (maskPhone as jest.Mock).mockReturnValue("(1");
      act(() => {
        result.current.handleTelefoneChange("1");
      });
      expect(result.current.telefoneError).toBe("Telefone incompleto");

      // Now clear
      (maskPhone as jest.Mock).mockReturnValue("");
      act(() => {
        result.current.handleTelefoneChange("");
      });
      expect(result.current.telefoneError).toBe("");
    });
  });

  // ==========================================================================
  // validateForm
  // ==========================================================================

  describe("validateForm", () => {
    it("returns invalid when nome is empty", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormEmail("user@test.com");
        result.current.setFormSenha("senha123");
      });

      let validation: { valid: boolean; message?: string };
      act(() => {
        validation = result.current.validateForm();
      });

      expect(validation!.valid).toBe(false);
      expect(validation!.message).toBe("Preencha todos os campos obrigatórios");
    });

    it("returns invalid when email is empty", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormNome("João");
        result.current.setFormSenha("senha123");
      });

      let validation: { valid: boolean; message?: string };
      act(() => {
        validation = result.current.validateForm();
      });

      expect(validation!.valid).toBe(false);
      expect(validation!.message).toBe("Preencha todos os campos obrigatórios");
    });

    it("returns invalid when senha is empty and requirePassword is true (default)", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormNome("João");
        result.current.setFormEmail("joao@test.com");
      });

      let validation: { valid: boolean; message?: string };
      act(() => {
        validation = result.current.validateForm();
      });

      expect(validation!.valid).toBe(false);
      expect(validation!.message).toBe("Preencha todos os campos obrigatórios");
    });

    it("returns valid when senha is empty but requirePassword is false (edit mode)", () => {
      (validatePhone as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormNome("João");
        result.current.setFormEmail("joao@test.com");
      });

      let validation: { valid: boolean; message?: string };
      act(() => {
        validation = result.current.validateForm(false);
      });

      expect(validation!.valid).toBe(true);
      expect(validation!.message).toBeUndefined();
    });

    it("returns invalid for bad email format", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormNome("João");
        result.current.setFormEmail("not-an-email");
        result.current.setFormSenha("senha123");
      });

      let validation: { valid: boolean; message?: string };
      act(() => {
        validation = result.current.validateForm();
      });

      expect(validation!.valid).toBe(false);
      expect(validation!.message).toBe("Digite um email válido");
    });

    it("returns invalid when phone is filled but invalid", () => {
      (validatePhone as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormNome("João");
        result.current.setFormEmail("joao@test.com");
        result.current.setFormSenha("senha123");
        result.current.setFormTelefone("123");
      });

      let validation: { valid: boolean; message?: string };
      act(() => {
        validation = result.current.validateForm();
      });

      expect(validation!.valid).toBe(false);
      expect(validation!.message).toBe("Telefone inválido");
    });

    it("returns valid when all fields are correct", () => {
      (validatePhone as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormNome("João");
        result.current.setFormEmail("joao@test.com");
        result.current.setFormSenha("senha123");
        result.current.setFormTelefone("(11) 99999-9999");
      });

      let validation: { valid: boolean; message?: string };
      act(() => {
        validation = result.current.validateForm();
      });

      expect(validation!.valid).toBe(true);
      expect(validation!.message).toBeUndefined();
    });

    it("returns valid when phone is empty (optional field)", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.setFormNome("João");
        result.current.setFormEmail("joao@test.com");
        result.current.setFormSenha("senha123");
      });

      let validation: { valid: boolean; message?: string };
      act(() => {
        validation = result.current.validateForm();
      });

      expect(validation!.valid).toBe(true);
    });
  });

  // ==========================================================================
  // prefillForm (edit mode)
  // ==========================================================================

  describe("prefillForm", () => {
    it("fills form with motorista data for editing", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.prefillForm({
          nome: "Maria Santos",
          email: "maria@test.com",
          telefone: "(11) 98888-8888",
        });
      });

      expect(result.current.formNome).toBe("Maria Santos");
      expect(result.current.formEmail).toBe("maria@test.com");
      expect(result.current.formTelefone).toBe("(11) 98888-8888");
    });

    it("clears senha when prefilling (password is not editable)", () => {
      const { result } = renderHook(() => useMotoristasForm());

      // Set senha first
      act(() => {
        result.current.setFormSenha("old-password");
      });

      act(() => {
        result.current.prefillForm({
          nome: "Maria",
          email: "maria@test.com",
        });
      });

      expect(result.current.formSenha).toBe("");
    });

    it("sets telefone to empty string when not provided", () => {
      const { result } = renderHook(() => useMotoristasForm());

      act(() => {
        result.current.prefillForm({
          nome: "Maria",
          email: "maria@test.com",
        });
      });

      expect(result.current.formTelefone).toBe("");
    });

    it("clears validation errors when prefilling", () => {
      const { result } = renderHook(() => useMotoristasForm());

      // Trigger errors first
      act(() => {
        result.current.validateEmail("bad");
      });
      expect(result.current.emailError).toBe("Digite um email válido");

      // Prefill should clear errors
      act(() => {
        result.current.prefillForm({
          nome: "Maria",
          email: "maria@test.com",
        });
      });

      expect(result.current.emailError).toBe("");
      expect(result.current.telefoneError).toBe("");
    });
  });

  // ==========================================================================
  // Mode switching (create vs edit)
  // ==========================================================================

  describe("create vs edit mode switching", () => {
    it("supports create flow: fill form -> validate with password -> reset", () => {
      (validatePhone as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useMotoristasForm());

      // Fill for create
      act(() => {
        result.current.setFormNome("Novo Motorista");
        result.current.setFormEmail("novo@test.com");
        result.current.setFormSenha("senha123");
      });

      let validation: { valid: boolean; message?: string };
      act(() => {
        validation = result.current.validateForm(true);
      });
      expect(validation!.valid).toBe(true);

      // Reset after creation
      act(() => {
        result.current.resetFormulario();
      });
      expect(result.current.formNome).toBe("");
      expect(result.current.formSenha).toBe("");
    });

    it("supports edit flow: prefill -> validate without password -> reset", () => {
      (validatePhone as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useMotoristasForm());

      // Prefill for edit
      act(() => {
        result.current.prefillForm({
          nome: "Motorista Existente",
          email: "existente@test.com",
          telefone: "(11) 99999-9999",
        });
      });

      expect(result.current.formNome).toBe("Motorista Existente");
      expect(result.current.formSenha).toBe("");

      // Validate without password
      let validation: { valid: boolean; message?: string };
      act(() => {
        validation = result.current.validateForm(false);
      });
      expect(validation!.valid).toBe(true);

      // Reset after edit
      act(() => {
        result.current.resetFormulario();
      });
      expect(result.current.formNome).toBe("");
    });
  });
});
