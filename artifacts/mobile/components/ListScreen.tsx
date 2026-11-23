import React from "react";
import { FlatList, View, StyleSheet, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "@/lib/colors";
import { EmptyState, LoadingView } from "@/components/ui";

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  compact = false,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.searchBar, compact && styles.searchBarCompact]}>
      <Feather name="search" size={16} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
      />
    </View>
  );
}

export function ListScreen<T>({
  data,
  keyExtractor,
  renderItem,
  isLoading,
  emptyTitle,
  emptySubtitle,
  header,
  footer,
  onRefresh,
  refreshing,
  onEndReached,
}: {
  data: T[] | undefined;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactElement;
  isLoading?: boolean;
  emptyTitle: string;
  emptySubtitle?: string;
  header?: React.ReactElement;
  footer?: React.ReactElement;
  onRefresh?: () => void;
  refreshing?: boolean;
  onEndReached?: () => void;
}) {
  if (isLoading && !data) return <LoadingView />;
  return (
    <FlatList
      data={data ?? []}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => renderItem(item)}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={<EmptyState title={emptyTitle} subtitle={emptySubtitle} />}
      contentContainerStyle={styles.listContent}
      scrollEnabled={(data?.length ?? 0) > 0}
      onRefresh={onRefresh}
      refreshing={!!refreshing}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      style={{ backgroundColor: colors.background }}
    />
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 48,
    marginBottom: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  searchBarCompact: { marginHorizontal: 0, marginVertical: 0, marginTop: 0, minHeight: 45 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  listContent: { paddingBottom: 40 },
});
