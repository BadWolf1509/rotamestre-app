import { render, fireEvent } from "@testing-library/react-native";
import React from "react";

import { CheckpointMarker } from "../CheckpointMarker";

describe("CheckpointMarker", () => {
  const onPress = jest.fn();
  const onCopyAddress = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("does not show callout when not selected", () => {
    const { queryByText } = render(
      <CheckpointMarker
        index={0}
        endereco="Rua A, 100"
        isSelected={false}
        onPress={onPress}
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(queryByText("PARTIDA")).toBeNull();
  });

  it("shows callout with PARTIDA label and address when selected (index 0)", () => {
    const { getByText } = render(
      <CheckpointMarker
        index={0}
        endereco="Rua A, 100"
        isSelected={true}
        onPress={onPress}
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(getByText("PARTIDA")).toBeTruthy();
    expect(getByText("Rua A, 100")).toBeTruthy();
  });

  it("shows callout with CHEGADA label for index 1+", () => {
    const { getByText } = render(
      <CheckpointMarker
        index={1}
        endereco="Rua B, 200"
        isSelected={true}
        onPress={onPress}
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(getByText("CHEGADA")).toBeTruthy();
  });

  it("shows unidade name in callout when selected and unidadeNome provided", () => {
    const { getByText } = render(
      <CheckpointMarker
        index={0}
        endereco="Rua A"
        isSelected={true}
        unidadeNome="WJX Locações"
        onPress={onPress}
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(getByText("WJX Locações")).toBeTruthy();
  });

  it("calls onPress when marker pressable is pressed", () => {
    const { getAllByRole } = render(
      <CheckpointMarker
        index={0}
        endereco="Rua A, 100"
        isSelected={false}
        onPress={onPress}
        onCopyAddress={onCopyAddress}
      />,
    );
    const buttons = getAllByRole("button");
    fireEvent.press(buttons[0]);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
