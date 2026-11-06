import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { View } from 'react-native';

type Props = {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
};

export function Sparkline({ data, width = 280, height = 64, positive }: Props) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const up = positive ?? data[data.length - 1] >= data[0];
  const stroke = up ? '#34d399' : '#f87171';
  const fillId = up ? 'gradUp' : 'gradDown';

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  });
  const line = points.join(' ');
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.35} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill={`url(#${fillId})`} />
        <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" />
      </Svg>
    </View>
  );
}
