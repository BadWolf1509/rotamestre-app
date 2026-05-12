import { render, fireEvent } from "@testing-library/react-native";
import React from "react";

import { FloatingActionButtons } from "../FloatingActionButtons";

const baseParada = {
  id: "p1",
  endereco: "Rua Teste, 100",
  latitude: -23.55,
  longitude: -46.63,
  status: "pendente",
  ordem: 1,
  is_checkpoint: false,
};

describe("FloatingActionButtons", () => {
  const onFitAll = jest.fn();
  const onCenterOnUser = jest.fn();
  const onNavigate = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders two buttons when no proximaParadaPendente", () => {
    const { getAllByRole } = render(
      <FloatingActionButtons
        onFitAll={onFitAll}
        onCenterOnUser={onCenterOnUser}
        isLocating={false}
        proximaParadaPendente={undefined}
        onNavigate={onNavigate}
      />,
    );
    expect(getAllByRole("button")).toHaveLength(2);
  });

  it("calls onFitAll when first FAB is pressed", () => {
    const { getAllByRole } = render(
      <FloatingActionButtons
        onFitAll={onFitAll}
        onCenterOnUser={onCenterOnUser}
        isLocating={false}
        proximaParadaPendente={undefined}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.press(getAllByRole("button")[0]);
    expect(onFitAll).toHaveBeenCalledTimes(1);
  });

  it("calls onCenterOnUser when second FAB is pressed", () => {
    const { getAllByRole } = render(
      <FloatingActionButtons
        onFitAll={onFitAll}
        onCenterOnUser={onCenterOnUser}
        isLocating={false}
        proximaParadaPendente={undefined}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.press(getAllByRole("button")[1]);
    expect(onCenterOnUser).toHaveBeenCalledTimes(1);
  });

  it("renders three buttons when proximaParadaPendente is set", () => {
    const { getAllByRole } = render(
      <FloatingActionButtons
        onFitAll={onFitAll}
        onCenterOnUser={onCenterOnUser}
        isLocating={false}
        proximaParadaPendente={baseParada as any}
        onNavigate={onNavigate}
      />,
    );
    expect(getAllByRole("button")).toHaveLength(3);
  });

  it("calls onNavigate when navigate FAB is pressed", () => {
    const { getAllByRole } = render(
      <FloatingActionButtons
        onFitAll={onFitAll}
        onCenterOnUser={onCenterOnUser}
        isLocating={false}
        proximaParadaPendente={baseParada as any}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.press(getAllByRole("button")[2]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
