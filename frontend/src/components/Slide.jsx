import { useEffect, useRef, useState } from "react";

import TextBlock from "./TextBlock";
import DrawingBlock from "./DrawingBlock";

import "../Slide.css";

function Slide({
  editor,
  drawingMode,
  drawingTool,
  slide,
  updateSlide,
}) {
  const slideRef = useRef(null);

  const [slideSize, setSlideSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (!slideRef.current) return;

    let animationFrameId;

    const updateSize = () => {
      animationFrameId = requestAnimationFrame(() => {
        if (slideRef.current) {
          setSlideSize({
            width: slideRef.current.clientWidth,
            height: slideRef.current.clientHeight,
          });
        }
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(slideRef.current);

    window.addEventListener("resize", updateSize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [slide.id]);

  if (!slide) return null;

  const isSizeReady =
    slideSize.width > 0 && slideSize.height > 0;

  return (
    <div className="slides-container">
      <div
        ref={slideRef}
        className="note-slide"
      >
        {/* Background */}
        <div className="slide-layer background-layer" />

        {/* Text */}
        <div
          className="slide-layer text-layer"
          style={{
            pointerEvents: drawingMode ? "none" : "auto",
          }}
        >
          <TextBlock editor={editor} />
        </div>

        {/* Drawing */}
        <div
          className={`slide-layer drawing-layer ${
            drawingMode ? "enabled" : ""
          }`}
          style={{
            pointerEvents: drawingMode ? "auto" : "none",
          }}
        >
          {isSizeReady && (
            <DrawingBlock
              key={slide.id}
              width={slideSize.width}
              height={slideSize.height}
              enabled={drawingMode}
              tool={drawingTool}
              drawingData={slide.drawings || []}
              onChange={(drawings) => {
                updateSlide({
                  drawings,
                });
              }}
            />
          )}
        </div>

        {/* Reserved Layers */}
        <div
          className="slide-layer image-layer"
          style={{ pointerEvents: "none" }}
        />

        <div
          className="slide-layer formula-layer"
          style={{ pointerEvents: "none" }}
        />

        <div
          className="slide-layer annotation-layer"
          style={{ pointerEvents: "none" }}
        />

        <div
          className="slide-layer ai-layer"
          style={{ pointerEvents: "none" }}
        />
      </div>
    </div>
  );
}

export default Slide;