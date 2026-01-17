// 简历预览画布（支持缩放和拖拽）
import { useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import { type ResumeData } from '../../types/resume';
import ResumePreview from './ResumePreview';

interface Props {
  data: ResumeData;
  photoData: string | null;
}

const STORAGE_KEY = 'resume-preview-transform';

interface TransformState {
  scale: number;
  positionX: number;
  positionY: number;
}

export default function ResumePreviewCanvas({ data, photoData }: Props) {
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  // 从 localStorage 加载保存的位置
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState && transformRef.current) {
      try {
        const state: TransformState = JSON.parse(savedState);
        setTimeout(() => {
          transformRef.current?.setTransform(
            state.positionX,
            state.positionY,
            state.scale,
            0
          );
        }, 100);
      } catch (e) {
        console.error('Failed to load transform state:', e);
      }
    }
  }, []);

  // 保存位置到 localStorage
  const saveTransformState = (state: any) => {
    try {
      const transformState: TransformState = {
        scale: state.scale,
        positionX: state.positionX,
        positionY: state.positionY
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transformState));
    } catch (e) {
      console.error('Failed to save transform state:', e);
    }
  };

  return (
    <div className="w-full h-full relative bg-gray-100">
      <TransformWrapper
        ref={transformRef}
        initialScale={0.75}
        minScale={0.2}
        maxScale={3}
        centerOnInit={true}
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: false, step: 0.5 }}
        panning={{
          velocityDisabled: false,
          excluded: ['input', 'textarea', 'button', 'select']
        }}
        limitToBounds={false}
        centerZoomedOut={false}
        alignmentAnimation={{ disabled: true }}
        onTransformed={(ref) => saveTransformState(ref.state)}
      >
        {({ zoomIn, zoomOut, resetTransform, centerView }) => (
          <>
            {/* 控制工具栏 */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-0 bg-white border-2 border-gray-900 shadow-lg">
              <button
                onClick={() => zoomIn()}
                className="p-3 hover:bg-gray-100 transition-colors border-b border-gray-200"
                title="放大 (滚轮向上)"
              >
                <ZoomIn className="w-5 h-5 text-gray-700" />
              </button>
              
              <button
                onClick={() => zoomOut()}
                className="p-3 hover:bg-gray-100 transition-colors border-b border-gray-200"
                title="缩小 (滚轮向下)"
              >
                <ZoomOut className="w-5 h-5 text-gray-700" />
              </button>
              
              <button
                onClick={() => {
                  resetTransform();
                  setTimeout(() => centerView(0.75), 50);
                }}
                className="p-3 hover:bg-gray-100 transition-colors border-b border-gray-200"
                title="重置视图"
              >
                <RotateCcw className="w-5 h-5 text-gray-700" />
              </button>
              
              <button
                onClick={() => {
                  resetTransform();
                  setTimeout(() => centerView(1), 50);
                }}
                className="p-3 hover:bg-gray-100 transition-colors"
                title="适应窗口"
              >
                <Maximize2 className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* 可缩放拖拽的内容区域 */}
            <TransformComponent
              wrapperClass="!w-full !h-full"
              contentClass="!w-full !h-full !flex !items-center !justify-center"
              wrapperStyle={{
                width: '100%',
                height: '100%',
                cursor: 'grab'
              }}
            >
              <div style={{ padding: '40px' }}>
                <ResumePreview
                  data={data}
                  photoData={photoData}
                />
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
