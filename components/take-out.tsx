"use client";

import { useState } from "react";
import { MoveForm } from "@/components/move-form";

export function TakeOut({
  itemId,
  unit,
  quantity,
  people,
}: {
  itemId: string;
  unit: string;
  quantity: number;
  people: string[];
}) {
  const [person, setPerson] = useState("");
  return (
    <MoveForm
      itemId={itemId}
      kind="out"
      unit={unit}
      quantity={quantity}
      people={people}
      person={person}
      onPerson={setPerson}
      focusPerson
    />
  );
}
