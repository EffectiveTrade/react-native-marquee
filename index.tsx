import React, { PureComponent, ReactNode } from 'react';
import {
  Animated,
  Easing,
  EasingFunction,
  LayoutChangeEvent,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  NativeSyntheticEvent,
  TextLayoutEventData,
} from 'react-native';

export interface IMarqueeTextProps extends TextProps {
  style?: StyleProp<TextStyle>;
  duration?: number;
  easing?: EasingFunction;
  loop?: boolean;
  marqueeOnStart?: boolean;
  marqueeResetDelay?: number;
  marqueeDelay?: number;
  onMarqueeComplete?: () => void;
  children: string;
  useNativeDriver?: boolean;
  inline?: boolean;
}

export interface IMarqueeTextState {
  animating: boolean;
}

export default class MarqueeText extends PureComponent<IMarqueeTextProps, IMarqueeTextState> {
  static defaultProps: Partial<IMarqueeTextProps> = {
    style: {},
    duration: 3000,
    easing: Easing.inOut(Easing.ease),
    loop: false,
    marqueeOnStart: false,
    marqueeDelay: 0,
    marqueeResetDelay: 0,
    onMarqueeComplete: () => {},
    useNativeDriver: true,
  };

  private static shouldAnimate(distance: number): boolean {
    return distance > 0;
  }

  state: IMarqueeTextState = {
    animating: false,
  };

  private distance: number | null;
  private contentFits: boolean;
  private animatedValue: Animated.Value;
  private timer: number;
  private containerWidth: number = 0;
  private textWidth: number = 0;
  private widthFull?: number;

  constructor(props: IMarqueeTextProps) {
    super(props);

    this.animatedValue = new Animated.Value(0);
    this.contentFits = true;
    this.distance = null;
    this.timer = 0;

    this.invalidateMetrics();
  }

  componentDidMount(): void {
    if (this.props.marqueeOnStart) {
      this.startAnimation();
    }
  }

  componentDidUpdate(props: IMarqueeTextProps, state: IMarqueeTextState): void {
    // Для строк фиксированной длины (например число с фиксированной точностью) можно не сбрасывать измерения и анимацию.
    // Изменения произойдут прямо в двигающейся строке и не нарушат верстку контейнера
    if ((typeof this.props.children !== 'string' && this.props.children !== props.children) ||
      (typeof this.props.children === 'string' && this.props.children.length !== props.children?.length)) {
      this.invalidateMetrics();
      this.resetAnimation();
    }
  }

  componentWillUnmount(): void {
    if (this.state.animating) {
      this.stopAnimation();
    }
    this.clearTimeout();
  }

  startAnimation(): void {
    if (this.state.animating) {
      return;
    }

    this.start(this.props.marqueeDelay!);
  }

  stopAnimation(): void {
    this.stop();
  }

  /**
   * Resets the marquee and restarts it after `marqueeDelay` milliseconds.
   * @marqueeResetDelay: метод resetAnimation вызывается в двух случаях:
   *  1) после завершения анимации; 2) после обновления пропсов;
   *  Этот параметр добавлен для того, чтобы в первом случае после marqueeResetDelay мс сбросить анимацию на начало,
   *  а потом после marqueeDelay мс запустить ее снова.
   *  Во втором случае нужно сразу же сбрсить анимацию на начало и после marqueeDelay мс запустить ее снова.
   */
  resetAnimation(marqueeResetDelay: number = 100) {
    this.setTimeout(() => {
      this.animatedValue.setValue(0);
      this.setState({ animating: false }, () => {
        this.startAnimation();
      });
    }, marqueeResetDelay);
  }

  start(timeDelay: number) {
    const { duration, easing, loop, onMarqueeComplete, useNativeDriver } = this.props;

    const callback = () => {
      this.setState({ animating: true });

      this.setTimeout(() => {
        this.calculateMetrics();

        if (!this.contentFits) {
          requestAnimationFrame(() => {
            Animated.timing(this.animatedValue, {
              toValue: -this.distance!,
              duration,
              easing,
              useNativeDriver,
            }).start(({ finished }: any) => {
              if (finished) {
                if (loop) {
                  this.resetAnimation(Math.max(100, this.props.marqueeResetDelay || 0));
                } else {
                  this.stop();
                  onMarqueeComplete!();
                }
              }
            });
          })
        }
      }, 100);
    };

    this.setTimeout(callback, timeDelay);
  }

  stop() {
    this.animatedValue.setValue(0);
    this.setState({ animating: false });
  }

  calculateMetrics = () => {
    this.distance = this.textWidth - this.containerWidth;
    const contentFits = !MarqueeText.shouldAnimate(this.distance);
    if (contentFits !== this.contentFits) {
      this.contentFits = contentFits;
      this.forceUpdate();
    }
  };

  invalidateMetrics() {
    // Null distance is the special value to allow recalculation
    this.distance = null;
    // Assume the marquee does not fit until calculations show otherwise
    this.contentFits = true;
    this.widthFull = undefined;
  }

  /**
   * Clears the timer
   */
  clearTimeout(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = 0;
      // console.log("Currently running timeout is cleared!!!");
    }
  }

  /**
   * Starts a new timer
   */
  setTimeout(fn: any, time: number = 0): void {
    this.clearTimeout();
    this.timer = setTimeout(fn, time);
  }

  onContainerLayout = (event: LayoutChangeEvent) => {
    this.containerWidth = Math.floor(event.nativeEvent.layout.width);
    this.calculateMetrics();
  };

  onTextLayout = (event: LayoutChangeEvent) => {
    this.textWidth = Math.floor(event.nativeEvent.layout.width);
    this.calculateMetrics();
  };

  render(): ReactNode {
    const { children, style, inline, ...rest } = this.props;
    const { width, height } = StyleSheet.flatten(style);

    return (
      <View style={[styles.container, { width, height, flex: !this.contentFits && inline ? 1 : undefined }]}>
        {/*Блок невидимый, служит для вычисления размера контейнера*/}
        <Text numberOfLines={1} onTextLayout={this.onBaseTextLayout} {...rest} style={[style, { opacity: 0, width: this.widthFull, maxWidth: '100%' }]}>
          {children}
        </Text>
        <ScrollView
          style={StyleSheet.absoluteFillObject}
          showsHorizontalScrollIndicator={false}
          horizontal={true}
          scrollEnabled={false}
          onContentSizeChange={this.calculateMetrics}
          onLayout={this.onContainerLayout}
        >
          <Animated.Text
            numberOfLines={1}
            {...rest}
            style={[style, { transform: [{ translateX: this.animatedValue }], width: null }]}
            onLayout={this.onTextLayout}
          >
            {children}
          </Animated.Text>
        </ScrollView>
      </View>
    );
  }

  onBaseTextLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (!this.widthFull) {
      this.widthFull = Math.floor(e.nativeEvent.lines.reduce((acc, i) => acc + i.width, 0));
      this.forceUpdate();
    }
  }
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    flexDirection: 'row',
  },
});
