import {
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Switch,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import {
  CONTROL_MOTION,
  MOTION_SPRING,
  MOTION_TRANSITION,
} from "@/lib/motion";
import { AutoHeight, Collapse, Pressable } from "@/components/motion";
import { SPACE } from "@/lib/spacing";
import { Skeletonize } from "@/components/ui/skeleton";

/**
 * 设置卡的逐卡骨架：页面用 <SettingCardsLoading loading> 包住设置卡，
 * 加载中每张 SettingCard 各自变成一块与自己同尺寸的色块（不显示转圈），
 * 卡片之外的标题、提示、按钮照常渲染；数据到达后每张卡原地淡入。
 * 不在 Provider 里的设置卡不受影响（DOM 不变）。
 */
const SettingCardLoadingContext = React.createContext<boolean | null>(null);

export function SettingCardsLoading({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <SettingCardLoadingContext.Provider value={loading}>
      {children}
    </SettingCardLoadingContext.Provider>
  );
}

/**
 * control 性格：Radix 按钮直接提升为 motion 组件（不额外包一层 DOM）。
 * 包一层 div 会在按钮 hidden 时留下空节点，占掉 Flex 的一份 gap；
 * 放在 DropdownMenu.Trigger 里时还会让 Slot 把触发器属性合并到包裹层而不是按钮上。
 */
const MotionButton = motion.create(Button);

/**
 * control 性格：保存中在文案前「长出」一个加载图标。
 * 文案本身始终挂载、不重播；图标槽宽度走弹簧，保存很快结束时会顺势收回（可被打断），
 * 不再用 AnimatePresence mode="wait" 先把整段文字淡出再淡入（按钮会空白一瞬并跳宽）。
 */
function SavingLabel({
  saving,
  children,
}: {
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center">
      <motion.span
        aria-hidden
        className="inline-flex shrink-0 items-center overflow-hidden"
        initial={false}
        animate={saving ? { width: 22, opacity: 1 } : { width: 0, opacity: 0 }}
        transition={{ width: CONTROL_MOTION.transition, opacity: MOTION_TRANSITION.fade }}
      >
        <LoaderCircle size={14} className="shrink-0 animate-spin" />
      </motion.span>
      {children}
    </span>
  );
}

/**
 * 条件出现的区块（错误提示、进度、来源徽标）：高度弹簧展开/收起，下方内容被平滑推开。
 * 收起时同时把它占用的那份 gap（负 margin）收回，末尾不会再跳一截。
 * gap 默认是设置页卡片栈的 block 档（SPACE.block），放在别的栈里时传入那个栈的间距。
 * 退出期间 AnimatePresence 保留旧内容，文字不会先消失再收起。
 */
const gapCollapseVariants = (gap: number): Variants => ({
  initial: { height: 0, opacity: 0, marginTop: -gap, overflow: "hidden" },
  animate: {
    height: "auto",
    opacity: 1,
    marginTop: 0,
    overflow: "hidden",
    transition: {
      height: MOTION_SPRING.soft,
      marginTop: MOTION_SPRING.soft,
      opacity: MOTION_TRANSITION.fadeIn,
    },
    transitionEnd: { overflow: "visible" },
  },
  exit: {
    height: 0,
    opacity: 0,
    marginTop: -gap,
    overflow: "hidden",
    transition: {
      height: MOTION_SPRING.soft,
      marginTop: MOTION_SPRING.soft,
      opacity: MOTION_TRANSITION.fadeOut,
    },
  },
});

export const GapCollapse = ({
  show,
  children,
  gap = SPACE.block,
}: {
  show: boolean;
  children: React.ReactNode;
  gap?: number;
}) => (
  <AnimatePresence initial={false}>
    {show ? (
      <motion.div key="content" variants={gapCollapseVariants(gap)} initial="initial" animate="animate" exit="exit">
        {children}
      </motion.div>
    ) : null}
  </AnimatePresence>
);

interface SettingCardProps {
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bordless?: boolean;
  direction?: "row" | "column" | "row-reverse" | "column-reverse";
  onHeaderClick?: () => void;
}

export function SettingCard({
  title = "",
  description = "",
  children,
  className = "",
  direction = "column",
  bordless = false,
  onHeaderClick = () => { },
}: SettingCardProps) {
  const actionChild = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === Action
  );

  const otherChildren = React.Children.toArray(children).filter(
    (child) => !(React.isValidElement(child) && child.type === Action)
  );
  const skeleton = React.useContext(SettingCardLoadingContext);

  const card = (
    /*
      设置卡本体不自带进场动画：
      页面切换已有 surface 淡入，需要先后次序的分组由 StaggeredList/StaggeredItem 负责。
      卡片再自带一次 y+scale 进场会与 StaggeredItem 叠加（位移翻倍、文字被 scale 发虚），
      且所有未包 StaggeredList 的卡会同时「弹」一下，抢走 Staging。
    */
    <Flex
      direction={direction}
      justify="between"
      align="center"
      wrap="wrap"
      style={{ borderColor: "var(--gray-a5)" }}
      className={
        bordless
          ? "km-setting-card border-0"
          : "km-setting-card border-1 rounded-md p-km-block bg-transparent min-h-8 " + className
      }
    >
      <Flex
        className="w-full"
        direction="row"
        justify="between"
        align="center"
        wrap="nowrap"
        onClick={onHeaderClick}
      >
        <Flex
          direction="column"
          gap="1"
          className="min-h-10"
          justify={"center"}
        >
          <label className="text-base font-medium" style={{ fontWeight: 600 }}>
            {title}
          </label>
          {description && (
            <label className="text-sm text-muted-foreground">
              {description}
            </label>
          )}
        </Flex>
        {actionChild}
      </Flex>
      {otherChildren}
    </Flex>
  );
  if (skeleton === null) return card;
  // 骨架包裹层始终存在（loading 翻转不换 DOM）；卡内再嵌套的设置卡不重复画色块
  return (
    <SettingCardLoadingContext.Provider value={null}>
      <Skeletonize loading={skeleton} className="km-setting-card-skeleton">
        {card}
      </Skeletonize>
    </SettingCardLoadingContext.Provider>
  );
}

function Action({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

SettingCard.Action = Action;

export function SettingCardSwitch({
  label = "",
  autoDisabled = true,
  defaultChecked,
  onChange,
  ...props
}: SettingCardProps & {
  label?: string;
  autoDisabled?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean, switchElement: HTMLButtonElement) => void;
}) {
  const switchRef = React.useRef<HTMLButtonElement>(null);
  const [disabled, setDisabled] = React.useState(false);
  const [checked, setChecked] = React.useState(defaultChecked || false);

  React.useEffect(() => {
    setChecked(Boolean(defaultChecked));
  }, [defaultChecked]);

  const handleChange = (c: boolean) => {
    if (autoDisabled) setDisabled(true);
    const previousValue = checked;
    setChecked(c);
    const result: any =
      onChange && switchRef.current
        ? onChange(c, switchRef.current)
        : undefined;
    if (autoDisabled) {
      const promise: Promise<any> = result;
      if (promise && typeof promise.then === "function") {
        promise
          .then(() => { })
          .catch(() => {
            setChecked(previousValue);
          })
          .finally(() => {
            setDisabled(false);
          });
      } else {
        setDisabled(false);
      }
    }
  };
  return (
    <SettingCard {...props} direction="column">
      <SettingCard.Action>
        <Flex direction="row" gap="2" align="center">
          <label>{label}</label>
          {/*
            control 性格：开关是「纯反馈」控件（按下才有反应，值变化本身由 Radix 滑块位移负责），
            这里只给 On 态的 thumb 推一下的触感 —— 按下时体积守恒地压扁一点（Squash & Stretch）。
          */}
          <Pressable tapScale={0.9} hoverScale={1}>
            <Switch
              ref={switchRef}
              checked={checked}
              onCheckedChange={handleChange}
              disabled={disabled}
            />
          </Pressable>
        </Flex>
      </SettingCard.Action>
    </SettingCard>
  );
}

/**
 * 设置卡里的按钮：点击后（autoDisabled 时）禁用，onClick 返回 Promise 则在其结束后恢复。
 * SettingCardButton 与 SettingCardIconButton 共用。
 */
function useAutoDisabledClick(
  onClick: ((buttonElement: HTMLButtonElement) => void) | undefined,
  autoDisabled: boolean,
) {
  const [disabled, setDisabled] = React.useState(false);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (autoDisabled) setDisabled(true);
    const result: any = onClick ? onClick(event.currentTarget) : undefined;
    if (autoDisabled) {
      const promise: Promise<any> = result;
      if (promise && typeof promise.then === "function") {
        promise.finally(() => setDisabled(false)).catch(() => {});
      } else {
        setDisabled(false);
      }
    }
  };
  return { disabled, handleClick };
}

export function SettingCardButton({
  label = "",
  variant = "solid",
  children,
  onClick,
  autoDisabled = true,
  ...props
}: SettingCardProps & {
  label?: string;
  variant?: "solid" | "soft" | "outline" | "ghost";
  children?: React.ReactNode;
  onClick?: (buttonElement: HTMLButtonElement) => void;
  autoDisabled?: boolean;
}) {
  const resolvedLabel = label;
  const { disabled, handleClick } = useAutoDisabledClick(onClick, autoDisabled);
  return (
    <SettingCard {...props} direction="column">
      <SettingCard.Action>
        <Flex>
          <Flex direction="row" gap="2" align="center">
            <label>{resolvedLabel}</label>
            {/* control 性格：按压回弹；执行中在文案前长出 loading 图标（文案不重播） */}
            <MotionButton
              onClick={handleClick}
              variant={variant}
              disabled={disabled}
              whileTap={disabled ? undefined : CONTROL_MOTION.tap}
              transition={CONTROL_MOTION.transition}
            >
              <SavingLabel saving={disabled}>{children}</SavingLabel>
            </MotionButton>
          </Flex>
        </Flex>
      </SettingCard.Action>
    </SettingCard>
  );
}

export function SettingCardIconButton({
  label = "",
  variant = "solid",
  children,
  onClick,
  autoDisabled = true,
  ...props
}: SettingCardProps & {
  label?: string;
  variant?: "solid" | "soft" | "outline" | "ghost";
  children?: React.ReactNode;
  onClick?: (buttonElement: HTMLButtonElement) => void;
  autoDisabled?: boolean;
}) {
  const resolvedLabel = label;
  const { disabled, handleClick } = useAutoDisabledClick(onClick, autoDisabled);
  return (
    <SettingCard {...props} direction="column">
      <SettingCard.Action>
        <Flex>
          <Flex direction="row" gap="2" align="center">
            <label>{resolvedLabel}</label>
            <Pressable>
              <IconButton
                onClick={handleClick}
                variant={variant}
                disabled={disabled}
                aria-label={resolvedLabel || undefined}
              >
                {/* 只保留外层 Pressable 一层按压反馈，内外两层同时缩放会叠成过冲 */}
                {children}
              </IconButton>
            </Pressable>
          </Flex>
        </Flex>
      </SettingCard.Action>
    </SettingCard>
  );
}

interface SettingCardShortTextInputProps
  extends Omit<React.ComponentProps<typeof TextField.Root>, 'onChange' | 'onKeyDown'> {
  // SettingCard 相关属性
  title?: string;
  description?: string;
  descriptionPlacement?: "header" | "footer";
  bordless?: boolean;

  // 按钮相关属性
  showSaveButton?: boolean;
  label?: string;
  autoDisabled?: boolean;
  isSaving?: boolean;

  // 保存回调
  OnSave?: (
    value: string,
    inputElement: HTMLInputElement,
    buttonElement: HTMLButtonElement
  ) => void | Promise<unknown>;

  // 额外内容
  children?: React.ReactNode | null;

  // 输入框事件回调 (可选，用于额外处理)
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function SettingCardShortTextInput({
  // SettingCard 属性
  title = "",
  description = "",
  descriptionPlacement = "header",
  bordless = false,

  // 按钮属性
  showSaveButton = true,
  label = "",
  autoDisabled = true,
  isSaving,

  // 保存回调
  OnSave = () => { },

  // 额外内容
  children = null,

  // 事件回调
  onChange,
  onKeyDown,

  // TextField.Root 的所有其他属性
  value,
  defaultValue,
  placeholder,
  disabled,
  type = "text",
  required,
  readOnly,
  maxLength,
  minLength,
  pattern,
  autoComplete,
  autoFocus,
  name,
  id,
  className = "w-full",
  ...restProps
}: SettingCardShortTextInputProps) {
  const { t } = useTranslation();
  const [internalDisabled, setInternalDisabled] = React.useState(false);
  const savingState = Boolean(isSaving) || internalDisabled;
  const normalizedValue =
    value !== undefined && value !== null ? String(value) : "";
  const normalizedDefaultValue =
    defaultValue !== undefined && defaultValue !== null
      ? String(defaultValue)
      : "";
  const [internalValue, setInternalValue] = React.useState(
    value !== undefined ? normalizedValue : normalizedDefaultValue
  );
  const previousDefaultValueRef = React.useRef(normalizedDefaultValue);
  const currentValue = value !== undefined ? normalizedValue : internalValue;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const resolvedLabel = label || t("common.save");

  // 当外部value改变时，同步内部状态
  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(normalizedValue);
      previousDefaultValueRef.current = normalizedDefaultValue;
      return;
    }

    if (normalizedDefaultValue !== previousDefaultValueRef.current) {
      const previousDefaultValue = previousDefaultValueRef.current;
      setInternalValue((currentInternalValue) =>
        currentInternalValue === previousDefaultValue
          ? normalizedDefaultValue
          : currentInternalValue
      );
      previousDefaultValueRef.current = normalizedDefaultValue;
    }
  }, [normalizedDefaultValue, normalizedValue, value]);

  const handleSave = () => {
    if (autoDisabled) setInternalDisabled(true);
    const valueToSave = currentValue?.toString() || "";
    const result: any =
      inputRef.current && buttonRef.current
        ? OnSave(valueToSave, inputRef.current, buttonRef.current)
        : undefined;
    if (autoDisabled) {
      const promise: Promise<any> = result;
      if (promise && typeof promise.then === "function") {
        promise
          .finally(() => setInternalDisabled(false))
          .catch(() => {});
      } else {
        setInternalDisabled(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // 只有在非受控模式下才更新内部状态
    if (value === undefined) {
      setInternalValue(newValue);
    }

    // 调用外部传入的 onChange 回调
    onChange?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 按 Enter 键时触发保存
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }

    // 调用外部传入的 onKeyDown 回调
    onKeyDown?.(e);
  };

  const showFooterDescription =
    descriptionPlacement === "footer" &&
    description !== undefined &&
    description !== null &&
    description !== "";
  const showFooterRow =
    descriptionPlacement === "footer" &&
    (showFooterDescription || showSaveButton);
  const showHiddenFooterSaveButton =
    descriptionPlacement === "footer" &&
    !showFooterDescription &&
    !showSaveButton;

  return (
    <SettingCard
      title={title}
      description={descriptionPlacement === "footer" ? undefined : description}
      bordless={bordless}
    >
      <Flex direction="column" className="w-full mt-km-group" gap="2" align="start">
        <TextField.Root
          {...restProps}
          className={className}
          // 始终受控（currentValue 已包含 defaultValue 的同步逻辑）；同时传 defaultValue 会触发 React 警告
          value={currentValue}
          placeholder={placeholder}
          disabled={disabled || savingState}
          type={type}
          required={required}
          readOnly={readOnly}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          name={name}
          id={id}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          ref={inputRef}
        >
        </TextField.Root>
        {children}
        {descriptionPlacement === "footer" ? (
          showFooterRow ? (
            <Flex
              direction="row"
              className="w-full"
              align="center"
              justify={showFooterDescription ? "between" : "end"}
              gap="4"
            >
              {showFooterDescription ? (
                <label className="min-w-0 flex-1 text-sm text-muted-foreground">
                  {description}
                </label>
              ) : null}
              <MotionButton
                ref={buttonRef}
                onClick={handleSave}
                variant="solid"
                hidden={!showSaveButton}
                disabled={savingState}
                whileTap={savingState ? undefined : CONTROL_MOTION.tap}
                transition={CONTROL_MOTION.transition}
              >
                <SavingLabel saving={savingState}>{resolvedLabel}</SavingLabel>
              </MotionButton>
            </Flex>
          ) : showHiddenFooterSaveButton ? (
            <Button
              ref={buttonRef}
              onClick={handleSave}
              variant="solid"
              hidden
              disabled={savingState}
            >
              {resolvedLabel}
            </Button>
          ) : null
        ) : (
          <MotionButton
            ref={buttonRef}
            onClick={handleSave}
            variant="solid"
            hidden={!showSaveButton}
            disabled={savingState}
            whileTap={savingState ? undefined : CONTROL_MOTION.tap}
            transition={CONTROL_MOTION.transition}
          >
            <SavingLabel saving={savingState}>{resolvedLabel}</SavingLabel>
          </MotionButton>
        )}
      </Flex>
    </SettingCard>
  );
}

export function SettingCardLongTextInput({
  title = "",
  description = "",
  descriptionPlacement = "header",
  label = "",
  defaultValue = "",
  OnSave = () => { },
  onChange,
  autoDisabled = true,
  isSaving,
  bordless = false,
  showSaveButton = true,
}: {
  title?: string;
  description?: string;
  descriptionPlacement?: "header" | "footer";
  label?: string;
  defaultValue?: string;
  OnSave?: (
    value: string,
    textAreaElement: HTMLTextAreaElement,
    buttonElement: HTMLButtonElement
  ) => void | Promise<unknown>;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  autoDisabled?: boolean;
  isSaving?: boolean;
  bordless?: boolean;
  showSaveButton?: boolean;
}) {
  const { t } = useTranslation();
  const [disabled, setDisabled] = React.useState(false);
  const savingState = Boolean(isSaving) || disabled;
  const [value, setValue] = React.useState(defaultValue);
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const resolvedLabel = label || t("common.save");

  React.useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const handleSave = () => {
    if (autoDisabled) setDisabled(true);
    const result: any =
      textAreaRef.current && buttonRef.current
        ? OnSave(value, textAreaRef.current, buttonRef.current)
        : undefined;
    if (autoDisabled) {
      const promise: Promise<any> = result;
      if (promise && typeof promise.then === "function") {
        promise.finally(() => setDisabled(false)).catch(() => {});
      } else {
        setDisabled(false);
      }
    }
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // 调用外部传入的 onChange 回调
    onChange?.(e);
  };

  const showFooterDescription =
    descriptionPlacement === "footer" &&
    description !== undefined &&
    description !== null &&
    description !== "";

  return (
    <SettingCard
      title={title}
      description={descriptionPlacement === "footer" ? undefined : description}
      bordless={bordless}
    >
      <Flex direction="column" className="w-full mt-km-group" gap="2" align="start">
        <TextArea
          className="w-full"
          resize="vertical"
          value={value}
          onChange={handleTextAreaChange}
          ref={textAreaRef}
        />
        {descriptionPlacement === "footer" ? (
          showFooterDescription || showSaveButton ? (
            <Flex
              direction="row"
              className="w-full"
              align="center"
              justify={showFooterDescription ? "between" : "end"}
              gap="4"
            >
              {showFooterDescription ? (
                <label className="min-w-0 flex-1 text-sm text-muted-foreground">
                  {description}
                </label>
              ) : null}
              {showSaveButton ? (
                <MotionButton
                  ref={buttonRef}
                  onClick={handleSave}
                  variant="solid"
                  disabled={savingState}
                  whileTap={savingState ? undefined : CONTROL_MOTION.tap}
                  transition={CONTROL_MOTION.transition}
                >
                  <SavingLabel saving={savingState}>{resolvedLabel}</SavingLabel>
                </MotionButton>
              ) : null}
            </Flex>
          ) : null
        ) : showSaveButton ? (
          <MotionButton
            ref={buttonRef}
            onClick={handleSave}
            variant="solid"
            disabled={savingState}
            whileTap={savingState ? undefined : CONTROL_MOTION.tap}
            transition={CONTROL_MOTION.transition}
          >
            <SavingLabel saving={savingState}>{resolvedLabel}</SavingLabel>
          </MotionButton>
        ) : null}
      </Flex>
    </SettingCard>
  );
}

export function SettingCardSelect({
  title,
  description,
  defaultValue = "",
  value,
  label = "",
  options = [],
  OnSave = () => { },
  autoDisabled = true,
  isSaving,
  bordless = false,
}: {
  title?: string;
  description?: string;
  defaultValue?: string;
  value?: string;
  label?: string;
  options?: { value: string; label?: string; disabled?: boolean }[];
  OnSave?: (value: string, buttonElement: HTMLButtonElement) => void;
  autoDisabled?: boolean;
  isSaving?: boolean;
  bordless?: boolean;
}) {
  const { t } = useTranslation();
  const [disabled, setDisabled] = React.useState(false);
  const savingState = isSaving !== undefined ? isSaving : disabled;
  const [selectedValue, setSelectedValue] = React.useState(
    value !== undefined ? value : defaultValue
  );
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const resolvedLabel = label || t("common.select");

  // 非受控时也跟随 defaultValue：页面先用占位数据渲染骨架，数据到达后要落到真实值上
  // （用户已手动选过的值不覆盖，与 SettingCardShortTextInput 的同步规则一致）
  const previousDefaultRef = React.useRef(defaultValue);
  React.useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
      return;
    }
    if (defaultValue !== previousDefaultRef.current) {
      const previousDefault = previousDefaultRef.current;
      previousDefaultRef.current = defaultValue;
      setSelectedValue((current) =>
        current === previousDefault ? defaultValue : current,
      );
    }
  }, [value, defaultValue]);

  const handleSave = (value: string) => {
    if (isSaving === undefined && autoDisabled) setDisabled(true);
    const previousValue = selectedValue; // 保存之前的值
    setSelectedValue(value); // 先更新选择的值

    const result: any = buttonRef.current
      ? OnSave(value, buttonRef.current)
      : undefined;
    if (autoDisabled) {
      const promise: Promise<any> = result;
      if (promise && typeof promise.then === "function") {
        promise
          .then(() => {
            // 成功时不需要额外操作，值已经更新
          })
          .catch(() => {
            // 错误时自动切换回之前的值
            setSelectedValue(previousValue);
          })
          .finally(() => {
            if (isSaving === undefined) {
              setDisabled(false);
            }
          });
      } else {
        if (isSaving === undefined) {
          setDisabled(false);
        }
      }
    }
  };

  // 获取要显示的文本，优先显示选择的值对应的标签
  const getDisplayText = () => {
    if (selectedValue) {
      const selectedOption = options.find(
        (option) => option.value === selectedValue
      );
      return selectedOption?.label || selectedValue;
    }
    return resolvedLabel;
  };

  return (
    <SettingCard title={title} description={description} bordless={bordless}>
      <SettingCard.Action>
        <Flex>
          <Flex direction="row" gap="2" align="center">
            <DropdownMenu.Root>
              {/*
                Trigger 的直接子元素必须是按钮本身：Slot 会把 aria-expanded / onPointerDown / ref
                合并到这个子元素上，若中间多包一层 span，键盘焦点在按钮上却打不开菜单。
                control 性格：按下回弹；选中项文案换成新值时上下错位交接（离散状态，不需要可逆）。
                保存中的禁用态由 Radix 自身样式表达，不再叠加额外的缩放/压暗。
                whitespace-nowrap：按钮不收缩，文字却允许换行时，外层按换行后的宽度收窄，
                窄屏下按钮会溢出卡片右边。
              */}
              <DropdownMenu.Trigger disabled={savingState}>
                <MotionButton
                  variant="soft"
                  className="whitespace-nowrap"
                  ref={buttonRef}
                  whileTap={savingState ? undefined : CONTROL_MOTION.tap}
                  transition={CONTROL_MOTION.transition}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={getDisplayText()}
                      className="inline-flex items-center gap-1"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={CONTROL_MOTION.transition}
                    >
                      {getDisplayText()}
                    </motion.span>
                  </AnimatePresence>
                  <DropdownMenu.TriggerIcon />
                </MotionButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                {options.map((option) => (
                  <DropdownMenu.Item
                    disabled={option.disabled}
                    key={option.value}
                    onSelect={() => {
                      handleSave(option.value);
                    }}
                  >
                    {option.label ? option.label : option.value}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Flex>
        </Flex>
      </SettingCard.Action>
    </SettingCard>
  );
}

export function SettingCardLabel({
  children,
}: {
  children: React.ReactNode | null;
}) {
  return (
    // 区块小标题：离上一组远（section）、离自己的卡片近（group），见 global.css .km-section-title
    <label className="km-section-title block text-xl font-bold" style={{ fontWeight: 600 }}>
      {children}
    </label>
  );
}

export function SettingCardCollapse({
  title,
  description,
  defaultOpen = false,
  children,
  bordless = false,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  bordless?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  // 首次展开前不挂载内容（与改造前「收起时不渲染」一致，重型子组件不会提前请求/初始化）；
  // 展开过一次后保持挂载：之后每次展开/收起都由同一个 Collapse 弹簧驱动 height，
  // 展开到一半再收起会保留速度顺势转向，而不是 AnimatePresence 那样卸载重来。
  const [hasOpened, setHasOpened] = React.useState(defaultOpen);
  if (open && !hasOpened) setHasOpened(true);
  // 每张折叠卡一个独立 id，避免页面上多张卡共用 "collapsible-content"
  const contentId = React.useId();

  return (
    <SettingCard
      title={title}
      description={description}
      onHeaderClick={() => setOpen(!open)}
      bordless={bordless}
    >
      <SettingCard.Action>
        <IconButton
          variant="soft"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={contentId}
        >
          {/*
            control 性格：箭头翻转走 CONTROL_MOTION 的弹簧（620 刚度、38 阻尼）。
            弹簧的好处是展开到一半再收起会保留当前速度顺势转向，而不是硬折返。
          */}
          <motion.div
            initial={false}
            animate={{ rotate: open ? 180 : 0 }}
            transition={CONTROL_MOTION.transition}
          >
            <ChevronDownIcon />
          </motion.div>
        </IconButton>
      </SettingCard.Action>
      {/*
        Collapse 展开属于 overlay 性格（从触发点「长出来」）：
        高度用 MOTION_SPRING.soft 弹簧（大块区域要重、要稳），
        内部内容再用一条 snappy 弹簧做轻微跟随（Follow-through），
        所以是「外壳先到位、内容随后落位」的两段式，而不是一个整体啪地出现。
      */}
      <Collapse
        open={open}
        id={contentId}
        // 内边距放在内层：height:0 时外层的 padding 仍会撑出 8px，收起后卡片底部多一条空隙
        className="w-full"
        style={{ overflow: "hidden" }}
        aria-hidden={!open}
        inert={!open}
      >
        <motion.div
          className="p-0"
          initial={false}
          animate={open ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
          transition={{ y: MOTION_SPRING.snappy, opacity: MOTION_TRANSITION.fade }}
        >
          {/* 分隔线：上贴标题（group），下与内容拉开 block */}
          <div className="border-t-1 mt-km-group mb-km-block" />
          {/*
            展开后内容自身变高/变矮（测试结果出现、字段增减）时高度用弹簧跟随，不跳。
            只在首次展开后挂载：首帧测量即真实高度，不会和 Collapse 的 0 -> auto 抢高度。
          */}
          {hasOpened ? <AutoHeight>{children}</AutoHeight> : null}
        </motion.div>
      </Collapse>
    </SettingCard>
  );
}

// Header slot for SettingCardCollapse
SettingCardCollapse.Header = function Header({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
};
