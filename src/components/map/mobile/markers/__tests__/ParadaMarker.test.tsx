import { render, fireEvent } from "@testing-library/react-native";
import React from "react";

import { ParadaMarker } from "../ParadaMarker";

const baseParada = {
  id: "p1",
  endereco: "Rua Teste, 100",
  latitude: -23.55,
  longitude: -46.63,
  status: "pendente",
  ordem: 1,
  is_checkpoint: false,
};

describe("ParadaMarker", () => {
  const onPress = jest.fn();
  const onLongPress = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders the stop number", () => {
    const { getByText } = render(
      <ParadaMarker
        parada={baseParada as any}
        isSelected={false}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    expect(getByText("1")).toBeTruthy();
  });

  it("does not show callout when not selected", () => {
    const { queryByText } = render(
      <ParadaMarker
        parada={baseParada as any}
        isSelected={false}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    expect(queryByText("Parada 1")).toBeNull();
  });

  it("shows callout with address when selected", () => {
    const { getByText } = render(
      <ParadaMarker
        parada={baseParada as any}
        isSelected={true}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    expect(getByText("Parada 1")).toBeTruthy();
    expect(getByText("Rua Teste, 100")).toBeTruthy();
  });

  it("calls onPress with parada.id when pressed", () => {
    const { getAllByRole } = render(
      <ParadaMarker
        parada={baseParada as any}
        isSelected={false}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    fireEvent.press(getAllByRole("button")[0]);
    expect(onPress).toHaveBeenCalledWith("p1");
  });

  it("shows recipient in callout when selected", () => {
    const parada = { ...baseParada, destinatario: "João Silva" };
    const { getByText } = render(
      <ParadaMarker
        parada={parada as any}
        isSelected={true}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    expect(getByText("João Silva")).toBeTruthy();
  });
});
