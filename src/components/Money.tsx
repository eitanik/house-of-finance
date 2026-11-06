import { Text, type TextProps } from 'react-native';

export function formatIls(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

export function Money({ value, style, ...rest }: { value: number } & TextProps) {
  return (
    <Text style={style} {...rest}>
      {formatIls(value)}
    </Text>
  );
}
