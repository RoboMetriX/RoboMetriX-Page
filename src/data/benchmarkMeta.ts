import type { CategoryId, Protocol } from '../types/benchmark';

export interface CategoryMeta {
  id: CategoryId;
  nameEn: string;
  nameZh: string;
  shortEn: string;
  quantitiesEn: string;
  quantitiesZh: string;
  tasks: string[];
}

export interface TaskMeta {
  id: string;
  category: CategoryId;
  nameEn: string;
  nameZh: string;
  qaEn: string;
  qaZh: string;
  execEn: string;
  execZh: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'GAS',
    nameEn: 'Geometric Attribute Selection',
    nameZh: '几何属性选择',
    shortEn: 'Attribute Selection',
    quantitiesEn: 'Length, height, area, volume',
    quantitiesZh: '长度、高度、面积、体积',
    tasks: ['length_select', 'metric_select', 'area_select', 'volume_select'],
  },
  {
    id: 'DDC',
    nameEn: 'Distance & Displacement Control',
    nameZh: '距离与位移控制',
    shortEn: 'Displacement Control',
    quantitiesEn: 'Linear travel, overhang, surface clearance',
    quantitiesZh: '直线位移、悬挑长度、表面净距',
    tasks: [
      'slide_block',
      'pull_drawer',
      'push_object',
      'metric_overhang_push',
      'surface_gap_placement',
      'metric_gap_placement',
    ],
  },
  {
    id: 'ARC',
    nameEn: 'Angular & Rotational Control',
    nameZh: '角度与旋转控制',
    shortEn: 'Rotational Control',
    quantitiesEn: 'Rotation, relative heading, articulation',
    quantitiesZh: '旋转角度、相对夹角、开合角',
    tasks: ['rotate_pointer', 'rod_angle', 'open_laptop'],
  },
  {
    id: 'SPF',
    nameEn: 'Spatial Placement & Formation',
    nameZh: '空间布局与队形构建',
    shortEn: 'Spatial Formation',
    quantitiesEn: 'Polar coords, trilateration, spacing, polygons',
    quantitiesZh: '极坐标、双锚点、等距与多边形',
    tasks: [
      'position_placement',
      'two_anchor_placement',
      'equal_spacing',
      'rectangle_formation',
      'circular_placement',
    ],
  },
  {
    id: 'CGM',
    nameEn: 'Composite Geometric Manipulation',
    nameZh: '复合几何操作',
    shortEn: 'Composite Geometry',
    quantitiesEn: 'Curved arc length, combinatorial stacking',
    quantitiesZh: '圆弧弧长、组合高度搭建',
    tasks: ['arc_slide_block', 'stack_to_height'],
  },
];

export const TASKS: TaskMeta[] = [
  {
    id: 'length_select',
    category: 'GAS',
    nameEn: 'Length Selection',
    nameZh: '螺丝刀长度辨别',
    qaEn: 'Tip-to-handle length of each of 5 screwdrivers',
    qaZh: '估计 5 把螺丝刀各自从批头到柄尾的长度',
    execEn: 'Place the matching screwdriver fully inside the toolbox',
    execZh: '将符合目标长度的螺丝刀完整放入工具箱',
  },
  {
    id: 'metric_select',
    category: 'GAS',
    nameEn: 'Height Selection',
    nameZh: '奶茶杯高度选择',
    qaEn: 'Base-to-straw-tip height of each of 5 cups',
    qaZh: '估计 5 个杯子从杯底到吸管顶端的总高',
    execEn: 'Place the matching cup upright inside the red platform',
    execZh: '将目标杯直立且完整放入红色平台区域',
  },
  {
    id: 'area_select',
    category: 'GAS',
    nameEn: 'Area Selection',
    nameZh: '面积辨别',
    qaEn: 'Top-view outer area of each of 10 plates or trays',
    qaZh: '估计 10 个盘子/托盘的俯视外轮廓面积',
    execEn: 'Place the matching item opening-up inside the red region',
    execZh: '将目标盘/托盘开口朝上放入红色区域',
  },
  {
    id: 'volume_select',
    category: 'GAS',
    nameEn: 'Volume Selection',
    nameZh: '体积辨别',
    qaEn: 'Volume of each of 5 cuboids',
    qaZh: '估计 5 个长方体各自的体积',
    execEn: 'Place the matching cuboid fully inside the white region',
    execZh: '将符合目标体积的长方体完整放入白色区域',
  },
  {
    id: 'slide_block',
    category: 'DDC',
    nameEn: 'Linear Sliding',
    nameZh: '滑动滑块',
    qaEn: 'Rail unit vector toward blue stop & 3D carriage top center',
    qaZh: '指向蓝色端挡的导轨单位向量与滑块顶面中心',
    execEn: 'Slide the carriage the requested distance toward the blue stop',
    execZh: '沿导轨向蓝色端挡滑动指定距离',
  },
  {
    id: 'pull_drawer',
    category: 'DDC',
    nameEn: 'Drawer Pulling',
    nameZh: '定距拉抽屉',
    qaEn: 'Outward unit direction of the drawer',
    qaZh: '抽屉向外拉开的单位方向向量',
    execEn: 'Pull the drawer the requested distance from closed',
    execZh: '将关闭的抽屉向外拉开指定距离',
  },
  {
    id: 'push_object',
    category: 'DDC',
    nameEn: 'Object Pushing',
    nameZh: '物体推动',
    qaEn: 'Initial planar XY center of the apple',
    qaZh: '苹果的初始 XY 平面中心坐标',
    execEn: 'Push the apple along −X by the requested displacement',
    execZh: '不抬起苹果，沿 −X 方向推动指定中心位移',
  },
  {
    id: 'metric_overhang_push',
    category: 'DDC',
    nameEn: 'Metric Overhang Push',
    nameZh: '木板定长悬挑',
    qaEn: 'Initial signed extension past platform edge along −X',
    qaZh: '木板前端相对平台边缘的初始有符号悬挑长度',
    execEn: 'Push the board along −X to overhang by the target length',
    execZh: '沿 −X 推动木板使其前端悬挑达到目标长度',
  },
  {
    id: 'surface_gap_placement',
    category: 'DDC',
    nameEn: 'Surface-Gap Placement',
    nameZh: '双物体表面间隙放置',
    qaEn: 'Side lengths of both cubes & Y coordinate of white line',
    qaZh: '两个魔方的边长与白线的 Y 坐标',
    execEn: 'Center both cubes upright on the line with target surface gap',
    execZh: '将两个魔方直立居中置于白线并满足指定表面净距',
  },
  {
    id: 'metric_gap_placement',
    category: 'DDC',
    nameEn: 'Metric-Gap Placement',
    nameZh: '表面净间隙放置',
    qaEn: 'Planar XY center of the fixed block',
    qaZh: '固定参考木块的 XY 平面中心',
    execEn: 'Place two bottles upright on each side at target clearances',
    execZh: '在固定木块两侧直立摆放两瓶物体并满足左右净距',
  },
  {
    id: 'rotate_pointer',
    category: 'ARC',
    nameEn: 'Pointer Rotation',
    nameZh: '指针定角旋转',
    qaEn: 'Planar XY center of the pointer pivot',
    qaZh: '指针旋转轴心的 XY 平面坐标',
    execEn: 'Rotate the pointer clockwise from the red zero mark',
    execZh: '从红色零位线顺时针旋转指针至指定角度',
  },
  {
    id: 'rod_angle',
    category: 'ARC',
    nameEn: 'Rod-Angle Placement',
    nameZh: '双杆夹角摆放',
    qaEn: 'Heading of fixed gray rod (blue → red, CCW from +X)',
    qaZh: '固定灰杆蓝端指向红端的朝向角（相对 +X 逆时针）',
    execEn: 'Place yellow rod inside circle at target CW angle from gray rod',
    execZh: '将黄杆放入圆内并相对灰杆形成指定顺时针夹角',
  },
  {
    id: 'open_laptop',
    category: 'ARC',
    nameEn: 'Laptop Opening',
    nameZh: '笔记本定角开盖',
    qaEn: 'Hinge-center Y coordinate & initial opening angle',
    qaZh: '铰链中心 Y 坐标与屏幕初始开合角',
    execEn: 'Open the screen to the requested angle from base',
    execZh: '将屏幕打开至相对底座的指定角度',
  },
  {
    id: 'position_placement',
    category: 'SPF',
    nameEn: 'Polar Placement',
    nameZh: '极坐标放置',
    qaEn: 'Planar XY center of the red reference point',
    qaZh: '红色参考点的 XY 平面中心坐标',
    execEn: 'Place bottle upright at target radius & CCW bearing',
    execZh: '将瓶子直立放置到指定极径与方位角位置',
  },
  {
    id: 'two_anchor_placement',
    category: 'SPF',
    nameEn: 'Two-Anchor Placement',
    nameZh: '双锚点放置',
    qaEn: 'Planar XY centers of red and blue markers',
    qaZh: '红、蓝双参考锚点的 XY 平面中心',
    execEn: 'Place bottle at both anchor distances on the target side',
    execZh: '按双锚点距离与连线侧别直立放置物体',
  },
  {
    id: 'equal_spacing',
    category: 'SPF',
    nameEn: 'Equal-Spacing Placement',
    nameZh: '等间距放置',
    qaEn: 'Planar XY intersection of the red and white lines',
    qaZh: '红白两参考线的 XY 平面交点',
    execEn: 'Align 4 upright bowls evenly along arrow from intersection',
    execZh: '以交点为起点沿箭头方向等距直立摆放 4 只碗',
  },
  {
    id: 'rectangle_formation',
    category: 'SPF',
    nameEn: 'Rectangle Formation',
    nameZh: '矩形排列',
    qaEn: 'Planar XY intersection of the red cross',
    qaZh: '红色十字交点的 XY 平面坐标',
    execEn: 'Arrange 4 upright bottles at corners of W × H rectangle',
    execZh: '将 4 个瓶子直立摆放到指定宽高矩形的四个顶点',
  },
  {
    id: 'circular_placement',
    category: 'SPF',
    nameEn: 'Circular Placement',
    nameZh: '圆周放置',
    qaEn: 'Planar XY center of the red mark',
    qaZh: '红色圆心标记的 XY 平面坐标',
    execEn: 'Place 3 upright dolls at target radius & 3 bearings',
    execZh: '在给定半径与三个方位角处直立摆放 3 个套娃',
  },
  {
    id: 'arc_slide_block',
    category: 'CGM',
    nameEn: 'Arc Slide',
    nameZh: '圆弧滑轨滑动',
    qaEn: 'Planar XY center & radius of circular rail path',
    qaZh: '滑块圆弧轨迹的 XY 圆心与半径',
    execEn: 'Slide carriage along arc by requested arc length',
    execZh: '沿圆弧滑轨向蓝色端挡滑动指定弧长',
  },
  {
    id: 'stack_to_height',
    category: 'CGM',
    nameEn: 'Stack to Height',
    nameZh: '目标高度搭建',
    qaEn: 'Height of each of 6 candidate blocks',
    qaZh: '估计 6 块候选积木各自的高度',
    execEn: 'Build one stable tower of target height inside green zone',
    execZh: '自选积木组合在绿色区域内搭出指定高度的稳定单塔',
  },
];

export const TASK_BY_ID: Record<string, TaskMeta> = Object.fromEntries(TASKS.map((t) => [t.id, t]));
export const CATEGORY_BY_ID: Record<CategoryId, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryMeta>;

export interface BenchmarkComparisonRow {
  name: string;
  paradigmEn: string;
  paradigmZh: string;
  qaEn: string;
  qaZh: string;
  numericGoalEn: string;
  numericGoalZh: string;
  paired: boolean;
  ours?: boolean;
}

export const BENCHMARK_COMPARISON: BenchmarkComparisonRow[] = [
  { name: 'RoboSpatial-Val', paradigmEn: 'Static visual', paradigmZh: '静态视觉', qaEn: 'Spatial (visual)', qaZh: '空间（静态）', numericGoalEn: '—', numericGoalZh: '—', paired: false },
  { name: 'Q-Spatial / Metric-Bench', paradigmEn: 'Static visual', paradigmZh: '静态视觉', qaEn: 'Metric (visual)', qaZh: '度量（静态）', numericGoalEn: '—', numericGoalZh: '—', paired: false },
  { name: 'ESI-Bench', paradigmEn: 'Embodied', paradigmZh: '具身评测', qaEn: 'Spatial (active)', qaZh: '空间（主动）', numericGoalEn: '—', numericGoalZh: '—', paired: false },
  { name: 'BEHAVIOR-Spatial', paradigmEn: 'Embodied', paradigmZh: '具身评测', qaEn: 'Spatial (visual)', qaZh: '空间（静态）', numericGoalEn: 'None', numericGoalZh: '无数值目标', paired: true },
  { name: 'LIBERO / VA-Bench / GeoMotion', paradigmEn: 'Embodied', paradigmZh: '具身评测', qaEn: '—', qaZh: '—', numericGoalEn: 'None', numericGoalZh: '无数值目标', paired: false },
  { name: 'RoboDojo-Sim / Labimus', paradigmEn: 'Embodied', paradigmZh: '具身评测', qaEn: '—', qaZh: '—', numericGoalEn: 'Fixed', numericGoalZh: '固定数值', paired: false },
  { name: 'RoboMetriX (Ours)', paradigmEn: 'Embodied', paradigmZh: '具身评测', qaEn: 'Metric (active)', qaZh: '度量（主动）', numericGoalEn: 'Episode-varied', numericGoalZh: '回合动态变化', paired: true, ours: true },
];

export interface CrossPlatformRow {
  robot: string;
  dof: string;
  aperture: string;
  GAS: number;
  DDC: number;
  ARC: number;
  SPF: number;
  CGM: number;
  Mean: number;
}

export const CROSS_PLATFORM_RESULTS: CrossPlatformRow[] = [
  { robot: 'UR5e', dof: '6-DoF', aperture: '0 – 87.1 mm', GAS: 45.0, DDC: 50.88, ARC: 53.82, SPF: 55.87, CGM: 63.72, Mean: 53.86 },
  { robot: 'Franka Panda', dof: '7-DoF', aperture: '0 – 80.0 mm', GAS: 30.0, DDC: 68.45, ARC: 61.77, SPF: 58.75, CGM: 46.98, Mean: 53.19 },
  { robot: 'PiPER', dof: '6-DoF', aperture: '0 – 100.0 mm', GAS: 32.5, DDC: 24.08, ARC: 25.26, SPF: 13.04, CGM: 18.23, Mean: 22.62 },
];

export interface GuidanceAblationRow {
  taskEn: string;
  taskZh: string;
  origCount: string;
  origPct: number;
  guidedCount: string;
  guidedPct: number;
  deltaPp: string;
  wrongOrig: string;
  wrongGuided: string;
}

export const GUIDANCE_ABLATION: GuidanceAblationRow[] = [
  {
    taskEn: 'Length Selection (40 layouts)',
    taskZh: '螺丝刀长度选择（40 组配对布局）',
    origCount: '9 / 40',
    origPct: 22.5,
    guidedCount: '25 / 40',
    guidedPct: 62.5,
    deltaPp: '+40.0 pp',
    wrongOrig: '8 / 40',
    wrongGuided: '1 / 40',
  },
  {
    taskEn: 'Volume Selection (40 layouts)',
    taskZh: '长方体体积选择（40 组配对布局）',
    origCount: '2 / 40',
    origPct: 5.0,
    guidedCount: '15 / 40',
    guidedPct: 37.5,
    deltaPp: '+32.5 pp',
    wrongOrig: '6 / 40',
    wrongGuided: '5 / 40',
  },
];

export const ROBOT_PLATFORMS = [
  { id: 'franka_panda', name: 'Franka Panda', dof: '7-DoF', aperture: '0 – 80 mm', image: './images/robots/franka_panda.jpg' },
  { id: 'ur5e', name: 'UR5e', dof: '6-DoF', aperture: '0 – 87.1 mm', image: './images/robots/ur5e.jpg' },
  { id: 'x5', name: 'ARX-X5', dof: '6-DoF', aperture: '0 – 88 mm', image: './images/robots/x5.jpg' },
  { id: 'piper', name: 'PiPER', dof: '6-DoF', aperture: '0 – 100 mm', image: './images/robots/piper.jpg' },
  { id: 'airbot_play', name: 'Airbot Play', dof: '6-DoF', aperture: '0 – 80 mm', image: './images/robots/airbot_play.jpg' },
  { id: 'yam', name: 'YAM', dof: '6-DoF', aperture: '0 – 93.9 mm', image: './images/robots/yam.jpg' },
];

export interface CuratedStrategyCase {
  id: string;
  strategyKey: 'image-change' | 'visual-alignment' | 'interactive-reference';
  badgeEn: string;
  badgeZh: string;
  titleEn: string;
  titleZh: string;
  summaryEn: string;
  summaryZh: string;
  formula: string;
  diagram: string;
  modelId: string;
  protocol: Protocol;
  taskId: string;
  seed: number;
  highlightRound: number;
  metricChipEn: string;
  metricChipZh: string;
}

export const CURATED_STRATEGIES: CuratedStrategyCase[] = [
  {
    id: 'strategy-image-change',
    strategyKey: 'image-change',
    badgeEn: '01 · Image-Change Measurement',
    badgeZh: '01 · 图像变化测量',
    titleEn: 'Motion-Induced Scale & Depth Recovery',
    titleZh: '基于相机位移的绝对尺度与深度反推',
    summaryEn:
      'Translates the wrist camera by a known displacement (Δx or Δz) and pairs pixel magnification ratios with proprioceptive travel to infer absolute object dimensions and volumes.',
    summaryZh:
      '控制腕部相机平移已知位移（Δx / Δz），将像素位移或透视放大倍率与机器人位移关联，无需先验物体尺寸即可恢复长度、深度与体积。',
    formula: 'h = Δz · ( s_t2 / (s_t2 − s_t1) − s_c2 / (s_c2 − s_c1) )',
    diagram: './images/strategies/03_depth_estimation.jpg',
    modelId: 'gpt-6-astra',
    protocol: 'qa',
    taskId: 'volume_select',
    seed: 100,
    highlightRound: 3,
    metricChipEn: '210.0 vs 210.0 cm³',
    metricChipZh: '实测 210.0 vs 真值 210.0 cm³',
  },
  {
    id: 'strategy-visual-alignment',
    strategyKey: 'visual-alignment',
    badgeEn: '02 · Visual Alignment Measurement',
    badgeZh: '02 · 视觉对齐测量',
    titleEn: 'Repeatable Pixel Alignment & Differential TCP',
    titleZh: '可重复像素对齐与末端位姿差分',
    summaryEn:
      'Moves the wrist camera until rod endpoints or rail bolts align with the same reference pixel, canceling camera–TCP offset and reading exact world-frame geometry from ΔT = T₂ − T₁.',
    summaryZh:
      '依次将目标端点或导轨特征对齐到同一图像参考像素，消去相机-TCP 固有偏置，通过差分位姿 ΔT = T₂ − T₁ 直接算出世界坐标系角度与圆心。',
    formula: 'θ = arg( −(T₂ − T₁) ) mod 360°',
    diagram: './images/strategies/05_endpoint_angle.jpg',
    modelId: 'gpt-6-astra',
    protocol: 'qa',
    taskId: 'rod_angle',
    seed: 100,
    highlightRound: 2,
    metricChipEn: '235.0° exact in 4 rounds',
    metricChipZh: '4 轮精确测出 235.0°',
  },
  {
    id: 'strategy-interactive-reference',
    strategyKey: 'interactive-reference',
    badgeEn: '03 · Interactive Reference Measurement',
    badgeZh: '03 · 交互式参考测量',
    titleEn: 'Bimanual Beacons & Gripper Calipers',
    titleZh: '双臂坐标信标与夹爪卡尺测量',
    summaryEn:
      'When single-view estimation is unreliable, models position the opposite end effector as a known world-frame beacon inside the wrist view or reorient blocks by 90° to measure with jaw span.',
    summaryZh:
      '直接观测不可靠时主动改造测量条件：用对侧末端作为已知世界坐标的视觉信标行对齐定位铰链，或翻转积木 90° 用夹爪开合行程卡尺量高。',
    formula: 'Y_H ≈ Y_R   |   h = f_opening × W_jaw',
    diagram: './images/strategies/08_bimanual_reference.jpg',
    modelId: 'gpt-6-astra',
    protocol: 'qa',
    taskId: 'open_laptop',
    seed: 100,
    highlightRound: 4,
    metricChipEn: '0.092 cm hinge Y err',
    metricChipZh: '铰链 Y 误差 0.092 cm',
  },
];

export type HighlightGroup = 'precision' | 'measurement' | 'failures';

export interface CuratedHighlight {
  episodeId: string;
  group: HighlightGroup;
  badgeEn: string;
  badgeZh: string;
  noteEn: string;
  noteZh: string;
}

export const CURATED_HIGHLIGHTS: CuratedHighlight[] = [
  // Group 1: High-Precision Execution
  {
    episodeId: 'gpt-6-astra__execution__stack_to_height__seed-101',
    group: 'precision',
    badgeEn: '0.04 mm height err',
    badgeZh: '高度误差 0.04 mm',
    noteEn: 'Gauges 6 candidate blocks online and stacks a stable tower within 0.04 mm of target height.',
    noteZh: '在线测算 6 块候选积木高度，搭建出误差仅 0.04 mm 的稳定单塔。',
  },
  {
    episodeId: 'gpt-6-astra__execution__open_laptop__seed-100',
    group: 'precision',
    badgeEn: '0.04° angle err',
    badgeZh: '角度误差 0.04°',
    noteEn: 'Localizes the screen hinge bimanually and articulates the lid to within 0.04° of target.',
    noteZh: '双臂定位屏幕铰链并将开合角精确控制至 0.04° 误差以内。',
  },
  {
    episodeId: 'gpt-6-astra__execution__circular_placement__seed-102',
    group: 'precision',
    badgeEn: '≤0.5 mm across 3 dolls',
    badgeZh: '三目标均 ≤0.5 mm',
    noteEn: 'Iteratively refines all three polar placements to sub-millimeter precision over 69 rounds.',
    noteZh: '经 69 轮闭环微调，将三个极坐标圆周摆位全部收束至亚毫米级。',
  },
  {
    episodeId: 'gpt-6-astra__execution__arc_slide_block__seed-100',
    group: 'precision',
    badgeEn: '1.64 mm arc err',
    badgeZh: '弧长误差 1.64 mm',
    noteEn: 'Tracks curved rail geometry and pushes the carriage within 1.64 mm of the target arc length.',
    noteZh: '沿圆弧导轨追踪几何弧长，最终位移误差 1.64 mm。',
  },

  // Group 2: Active Robotic Measurement (Embodied Metric QA)
  {
    episodeId: 'gpt-6-astra__qa__rod_angle__seed-100',
    group: 'measurement',
    badgeEn: '0.00° exact · 4 rounds',
    badgeZh: '4 轮零误差测出 235°',
    noteEn: 'Aligns both rod endpoints to the same wrist pixel and reads exact 235.0° heading from ΔT.',
    noteZh: '将灰杆两端依次对齐至同一腕部像素，通过末端差分位姿 ΔT 零误差测出朝向角。',
  },
  {
    episodeId: 'gpt-6-astra__qa__circular_placement__seed-102',
    group: 'measurement',
    badgeEn: '0.06 mm center err',
    badgeZh: '圆心误差 0.06 mm',
    noteEn: 'Centers the wrist camera over the red anchor to measure its world XY coordinate within 0.06 mm.',
    noteZh: '将腕部相机正对红色锚点中心，以 0.06 mm 精度读出世界坐标系位置。',
  },
  {
    episodeId: 'gpt-6-astra__qa__arc_slide_block__seed-100',
    group: 'measurement',
    badgeEn: '0.16 mm center err',
    badgeZh: '圆心误差 0.16 mm',
    noteEn: 'Samples multiple waypoints along the circular rail to fit both center and radius to sub-mm error.',
    noteZh: '沿圆弧轨道多点采样，拟合出亚毫米精度的圆心与轨迹半径。',
  },
  {
    episodeId: 'gpt-6-astra__qa__volume_select__seed-100',
    group: 'measurement',
    badgeEn: '4 / 5 exact cm³',
    badgeZh: '4 / 5 个长方体零误差',
    noteEn: 'Descends the wrist camera by known Δz and uses magnification ratios to recover cuboid volumes.',
    noteZh: '控制腕部相机下移已知位移 Δz，利用透视倍率变化反推出长方体体积。',
  },
  {
    episodeId: 'gpt-6-astra__qa__length_select__seed-100',
    group: 'measurement',
    badgeEn: '≤1.5 mm on 5 tools',
    badgeZh: '5 把工具均 ≤1.5 mm',
    noteEn: 'Sweeps across all five screwdrivers with calibrated lateral camera shifts to measure lengths.',
    noteZh: '横向平移腕部相机建立像素尺度基准，精确估计全部 5 把螺丝刀长度。',
  },
  {
    episodeId: 'gpt-6-astra__qa__open_laptop__seed-100',
    group: 'measurement',
    badgeEn: '0.92 mm hinge Y err',
    badgeZh: '铰链 Y 误差 0.92 mm',
    noteEn: 'Positions the opposite gripper inside the wrist view as a known coordinate beacon for the hinge.',
    noteZh: '将对侧末端置于腕部视野内充当已知世界坐标信标，精准标定铰链 Y 坐标。',
  },
  {
    episodeId: 'gpt-6-astra__qa__stack_to_height__seed-101',
    group: 'measurement',
    badgeEn: '2 / 6 exact blocks',
    badgeZh: '近处积木零误差',
    noteEn: 'Measures foreground block heights accurately while distant occluded blocks drift by ~5 cm.',
    noteZh: '前排积木高度测量精准，但后排遮挡积木出现约 5 cm 估计漂移。',
  },

  // Group 3: Understanding–Execution Gaps & Cross-Model Failures
  {
    episodeId: 'gpt-6-astra__execution__length_select__seed-100',
    group: 'failures',
    badgeEn: 'Matched QA 90.0 → Exec 0.0',
    badgeZh: '同场景 QA 90 → 执行 0',
    noteEn: 'Accurately measures all 5 tools in QA, yet skips systematic comparison and grasps the wrong lane.',
    noteZh: '同场景 QA 精准测出全部 5 把螺丝刀，但独立执行时跳过系统比对误抓错项。',
  },
  {
    episodeId: 'gpt-6-astra__execution__volume_select__seed-100',
    group: 'failures',
    badgeEn: 'Matched QA 90.0 → Exec 0.0',
    badgeZh: '同场景 QA 90 → 执行 0',
    noteEn: 'Recovers exact 210 cm³ target volume in QA, yet mis-binds an adjacent distractor during Execution.',
    noteZh: 'QA 阶段精确算出 210 cm³ 目标体积，执行阶段却将相邻干扰块误绑入区。',
  },
  {
    episodeId: 'gpt-6-astra__execution__rod_angle__seed-100',
    group: 'failures',
    badgeEn: 'Matched QA 100 → Exec 0.0',
    badgeZh: '同场景 QA 100 → 执行 0',
    noteEn: 'Measures exact 235.0° angle in 4 QA rounds, yet hits step horizon with 63.5° residual error in Execution.',
    noteZh: 'QA 仅用 4 轮零误差测出角度，执行阶段却在耗尽步数后仍残留 63.5° 角度误差。',
  },
  {
    episodeId: 'gpt-6.1-sol__execution__circular_placement__seed-102',
    group: 'failures',
    badgeEn: '68 rounds · 9–28 mm drift',
    badgeZh: '68 轮仍有 9–28 mm 漂移',
    noteEn: 'Spends the same ~68-round budget as Astra on s102, but drifts 9–28 mm across all 3 placements.',
    noteZh: '在 s102 同场景消耗与 Astra 相同的 68 轮预算，但三处摆位漂移达 9–28 mm。',
  },
  {
    episodeId: 'claude-opus-5-5__execution__circular_placement__seed-102',
    group: 'failures',
    badgeEn: 'Round-1 proactive give_up',
    badgeZh: '第 1 轮主动放弃',
    noteEn: 'Scores >99 on matched QA yet calls give_up on Round 1, judging 1 mm RGB-only accuracy infeasible.',
    noteZh: '同场景 QA 超过 99 分，却在执行第 1 轮直接调用 give_up 放弃尝试。',
  },
];
