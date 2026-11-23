import React, { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { Button, Card, FormField, SectionTitle } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useLang } from "@/contexts/lang-context";
import { colors } from "@/lib/colors";
import { formatLocalDate, parseContactMoneyAmount } from "@/lib/contact-money-operation";

export type ContactMoneyOperationInput = {
  amount: number;
  date: string;
  reference?: string;
  note?: string;
};

type Props = {
  title: string;
  submitLabel: string;
  caisseHint: string;
  submitTestId: string;
  loading: boolean;
  onSubmit: (input: ContactMoneyOperationInput) => void;
};

export default function ContactMoneyOperationForm({
  title,
  submitLabel,
  caisseHint,
  submitTestId,
  loading,
  onSubmit,
}: Props) {
  const { t, lang } = useLang();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date>(() => new Date());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    const parsedAmount = parseContactMoneyAmount(amount);
    if (parsedAmount == null) {
      setError(t("Saisissez un montant positif valide (2 décimales maximum).", "أدخل مبلغًا موجبًا صحيحًا (بحد أقصى منزلتين عشريتين)."));
      return;
    }
    setError("");
    onSubmit({
      amount: parsedAmount,
      date: formatLocalDate(date),
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={styles.screen}
      contentContainerStyle={styles.content}
      bottomOffset={72}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <SectionTitle>{title}</SectionTitle>
        <Text style={styles.hint}>{caisseHint}</Text>
        <FormField
          label={t("Montant (دج)", "المبلغ (دج)")}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0,00"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <DateField
          label={t("Date", "التاريخ")}
          value={date}
          onChange={setDate}
          maximumDate={new Date()}
        />
        <FormField
          label={t("Référence (optionnel)", "المرجع (اختياري)")}
          value={reference}
          onChangeText={setReference}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <FormField
          label={t("Note (optionnelle)", "ملاحظة (اختيارية)")}
          value={note}
          onChangeText={setNote}
          multiline
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={submitLabel}
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          testID={submitTestId}
        />
      </Card>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 36 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: -4, marginBottom: 14 },
  error: { color: colors.danger, fontSize: 13, textAlign: "center", marginBottom: 10 },
});
