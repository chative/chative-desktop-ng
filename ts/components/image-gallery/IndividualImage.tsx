import React, { useEffect, useRef, useState } from 'react';
import QuickPinchZoom, { make3dTransformValue } from 'react-quick-pinch-zoom';
import { saveAs } from 'file-saver';
import * as GoogleChrome from '../../util/GoogleChrome';

interface IImageFile {
  url: string;
  caption: string;
  fileName: string;
  contentType: string;
}

interface IProps {
  image: IImageFile;
  handlePrevImage: () => void;
  handleNextImage: () => void;
  index: number;
  totalNumImage: number;
}

interface IEditorOption {
  imgSrc?: string;
  onClick?: any;
  component?: any;
  disabled?: boolean;
}

export const IndividualImage: React.FC<IProps> = props => {
  const {
    image: { url: url, fileName: fileName, contentType: contentType },
    handlePrevImage,
    handleNextImage,
    index,
    totalNumImage,
  } = props;

  const [dimensions, setDimensions] = useState({
    scale: 1,
    x: 0,
    y: 0,
  });

  const [rotation, setRotation] = useState(0);

  let imageRef = useRef();
  const quickPinchZoomRef = useRef(null);

  const { current: img } = imageRef;
  const { current: quickPinchZoomElement } = quickPinchZoomRef;

  useEffect(() => {
    if (dimensions && rotation && quickPinchZoomElement) {
      reset3dStyle();
      setRotation(0);
    }
  }, [url, img, quickPinchZoomElement]);

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  useEffect(() => {
    if (img) {
      const centerImg = async () => {
        // We need this delay to initialise the center dimension on each image load
        await delay(1000);

        const { width, height } = img as any;

        const centerX = width / 2;
        const centerY = height / 2;

        //  Reset dimensions on image change
        setDimensions({ scale: 1, x: centerX, y: centerY });
      };
      centerImg();
    }
  }, [img]);

  // On-click icon functions
  const downloadImage = () => {
    saveAs(url, fileName); // Put your image url here.
  };

  const copyImage = () => {
    (window as any).copyImageFile(url, contentType);
  };

  const openFileExternal = () => {
    (window as any).openFileDefault(url, fileName, contentType);
  };

  const onZoomIn = () => {
    (quickPinchZoomRef.current as any).scaleTo({
      scale: dimensions.scale + 1,
      x: dimensions.x,
      y: dimensions.y,
    });

    if (dimensions.scale + 1 > 10) {
      setDimensions({ ...dimensions, scale: 10 });
    } else {
      setDimensions({ ...dimensions, scale: dimensions.scale + 1 });
    }
  };

  const onZoomOut = () => {
    const newScale = dimensions.scale - 1 < 1 ? 1 : dimensions.scale - 1;

    (quickPinchZoomRef.current as any).scaleTo({
      scale: newScale,
      x: dimensions.x,
      y: dimensions.y,
    });

    if (dimensions.scale - 1 < 1) {
      setDimensions({ ...dimensions, scale: 1 });
    } else {
      setDimensions({ ...dimensions, scale: dimensions.scale - 1 });
    }
  };

  // Style manipulation functions
  const reset3dStyle = () => {
    const { width, height } = img as any;

    const centerX = width / 2;
    const centerY = height / 2;

    (quickPinchZoomElement as any).alignCenter({
      x: centerX,
      y: centerY,
      scale: 1,
    });
  };

  const onReset = () => {
    setDimensions({ ...dimensions, scale: 1 });
    setRotation(0);
    reset3dStyle();
  };

  const onRotate = () => {
    setRotation(prevState => prevState - 90);
  };

  const onUpdate = (inputDimensions: any) => {
    let { x, y, scale } = inputDimensions;

    const { current: img } = imageRef;
    if (img) {
      // const value = make3dTransformValue({ ...dimensions });
      const value = make3dTransformValue({ ...inputDimensions });

      (img as any).style.setProperty('transform', value);
    }

    setDimensions({ x, y, scale } as any);
  };

  const renderEditorIcon = (
    imgSrc: string,
    onClickFn: () => void,
    index: number,
    disabled: boolean
  ) => {
    return (
      <button
        key={index}
        className={'editor-icon'}
        onClick={() => onClickFn()}
        disabled={disabled}
      >
        <img height={25} src={imgSrc} />
      </button>
    );
  };

  // @ts-ignore
  const isImage = GoogleChrome.isImageTypeSupported(contentType);
  // @ts-ignore
  const isVideo = GoogleChrome.isVideoTypeSupported(contentType);

  const EDITOR_OPTIONS: IEditorOption[] = [
    {
      imgSrc: 'previous-page.png',
      onClick: handlePrevImage,
      disabled: index == 0,
    },
    {
      component: (
        <div key={'placeholder key 1'} style={{ width: 72 }}>
          {index + 1} of {totalNumImage}
        </div>
      ),
    },
    {
      imgSrc: 'next-page.png',
      onClick: handleNextImage,
      disabled: index >= totalNumImage - 1,
    },
    { imgSrc: isImage ? 'divider.png' : '' },
    { imgSrc: isImage ? 'zoom-out.png' : '', onClick: onZoomOut },

    // { component: <div key={'placeholder key 2'}>Zoom: {Math.floor(dimensions.scale * 100)}%</div> },
    { imgSrc: isImage ? 'zoom-in.png' : '', onClick: onZoomIn },
    { imgSrc: isImage ? 'reset.png' : '', onClick: onReset },
    { imgSrc: 'divider.png' },
    { imgSrc: isImage ? 'rotate.png' : '', onClick: onRotate },
    { imgSrc: isImage ? 'copy.png' : '', onClick: copyImage },
    { imgSrc: 'download.png', onClick: downloadImage },
    // { imgSrc: 'forward.png', onClick: onForwardImage },
    { imgSrc: 'open-external.png', onClick: openFileExternal },
  ];

  const renderContent = () => {
    if (isImage) {
      return (
        <QuickPinchZoom
          ref={quickPinchZoomRef}
          maxZoom={10}
          onUpdate={onUpdate}
        >
          <img
            style={{
              objectFit: 'contain',
              maxHeight: 600,
              maxWidth: 900,
            }}
            ref={imageRef as any}
            alt={'img'}
            src={url}
          />
        </QuickPinchZoom>
      );
    }

    if (isVideo) {
      return (
        <video
          role="button"
          controls={true}
          key={url}
          style={{
            outline: 'none',
            flexGrow: 1,
            flexShrink: 0,
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        >
          <source src={url} />
        </video>
      );
    }

    return <div>Unsupported File Type</div>;
  };

  return (
    <>
      <div
        className={'drag-title'}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 999,
          width: '100%',
          backgroundColor: '#E4E6E7',
          height: 60,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 20,
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 20,
          }}
        >
          {EDITOR_OPTIONS.map((option, index) => {
            if (option.imgSrc) {
              return renderEditorIcon(
                option.imgSrc,
                option.onClick,
                index,
                !!option.disabled
              );
            }
            if (option.component) {
              return option.component;
            }
          })}
        </div>
      </div>

      <div
        style={{
          transform: `rotate(${rotation}deg)`,
          transitionDuration: rotation ? '0.25s' : undefined,
        }}
        className="image-container"
      >
        {renderContent()}
      </div>
    </>
  );
};
