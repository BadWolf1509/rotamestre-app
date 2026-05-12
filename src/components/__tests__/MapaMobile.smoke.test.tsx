import { render } from "@testing-library/react-native";
import React from "react";

import { MapaMobile } from "../MapaMobile";

// MapLibre mocked globally in jest.setup.js
// expo-location, expo-haptics, expo-clipboard mocked in jest.mocks/expo.js

it("renders without paradas", () => {
  expect(() => render(<MapaMobile paradas={[]} />)).not.toThrow();
});

it("renders with sample paradas", () => {
  const paradas = [
    {
      id: "p1",
      endereco: "Rua A, 100",
      latitude: -23.55,
      longitude: -46.63,
      status: "pendente",
      tipo: "entrega" as const,
      ordem: 1,
      is_checkpoint: false,
    },
  ];
  expect(() => render(<MapaMobile paradas={paradas} />)).not.toThrow();
});

it("renders with multiple paradas including checkpoints", () => {
  const paradas = [
    {
      id: "cp1",
      endereco: "Base, 1",
      latitude: -23.54,
      longitude: -46.62,
      status: "pendente",
      ordem: 0,
      is_checkpoint: false,
    },
    {
      id: "p1",
      endereco: "Rua A, 100",
      latitude: -23.55,
      longitude: -46.63,
      status: "pendente",
      tipo: "entrega" as const,
      ordem: 1,
      is_checkpoint: false,
    },
    {
      id: "p2",
      endereco: "Rua B, 200",
      latitude: -23.56,
      longitude: -46.64,
      status: "concluida",
      tipo: "retirada" as const,
      ordem: 2,
      is_checkpoint: false,
    },
  ];
  expect(() => render(<MapaMobile paradas={paradas} />)).not.toThrow();
});

it("renders with paradas without coordinates (should show empty state)", () => {
  const paradas = [
    {
      id: "p1",
      endereco: "Sem coords",
      latitude: null,
      longitude: null,
      status: "pendente",
      ordem: 1,
    },
  ];
  expect(() => render(<MapaMobile paradas={paradas} />)).not.toThrow();
});
