import { ipcRenderer } from 'electron';
import React, { useEffect, useState } from 'react';
import { IndividualImage } from './IndividualImage';

interface IImageFile {
  url: string;
  caption: string;
  fileName: string;
  contentType: string;
}

export const ImageGallery = () => {
  const [index, setIndex] = useState(0);
  const [showIndex, setShownIndex] = useState(0);
  const [images, setImages] = useState<IImageFile[]>([]);

  const endIndex = images.length - 1;

  useEffect(() => {
    let imageFiles = (window as any).mediaFiles;
    let selectedIndex = (window as any).selectedIndex;

    if (imageFiles) {
      let parsedImageFiles: IImageFile[] = JSON.parse(imageFiles);
      setImages(parsedImageFiles);
      setIndex(selectedIndex);
    }
  }, []);

  useEffect(() => {
    // Listen for the event
    ipcRenderer.on('receive-images', (_, { mediaFiles, selectedIndex }) => {
      let parsedImageFiles: IImageFile[] = JSON.parse(mediaFiles);
      setImages(parsedImageFiles);
      setIndex(selectedIndex);
    });

    ipcRenderer.on('close-image-window', () => {
      setImages([]);
    });
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyBoardEvent);
  }, []);

  useEffect(() => {
    if (images.length <= 0) return;

    if (index < 0) {
      setIndex(0);
      setShownIndex(0);
    } else if (index >= images.length) {
      setIndex(endIndex);
      setShownIndex(endIndex);
    } else {
      setShownIndex(index);
    }
  }, [index]);

  const handleKeyBoardEvent = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      window.close();

      return;
    }

    if (event.key === 'ArrowLeft') {
      setIndex(prevState => prevState - 1);

      return;
    }

    if (event.key === 'ArrowRight') {
      setIndex(prevState => prevState + 1);

      return;
    }
  };

  const handlePrevImage = () => {
    setIndex(prevState => prevState - 1);
  };

  const handleNextImage = () => {
    setIndex(prevState => prevState + 1);
  };

  const renderImage = () => {
    if (images.length === 0) return;

    let currIndex;

    if (index < 0) {
      currIndex = 0;
    } else if (index >= endIndex) {
      currIndex = endIndex;
    } else {
      currIndex = index;
    }

    return (
      <IndividualImage
        key={currIndex}
        handlePrevImage={handlePrevImage}
        handleNextImage={handleNextImage}
        image={images[currIndex]}
        index={showIndex}
        totalNumImage={images.length}
      />
    );
  };

  // const renderCaption = () => {
  //   if (images.length === 0) return;
  //
  //   let currIndex;
  //
  //   if (index < 0) {
  //     currIndex = 0;
  //   } else if (index >= endIndex) {
  //     currIndex = endIndex;
  //   } else {
  //     currIndex = index;
  //   }
  //
  //   return images[currIndex].caption;
  // };

  return (
    <>
      {renderImage()}
      {/*<div*/}
      {/*  style={{*/}
      {/*    position: 'fixed',*/}
      {/*    bottom: 0,*/}
      {/*    left: 0,*/}
      {/*    zIndex: 999,*/}
      {/*    width: '100%',*/}
      {/*    backgroundColor: 'rgb(246, 246, 246)',*/}
      {/*  }}*/}
      {/*>*/}
      {/*  {renderCaption() && (*/}
      {/*    <div style={{ textAlign: 'center', marginBottom: 10, marginTop: 10 }}>*/}
      {/*      {renderCaption()}*/}
      {/*    </div>*/}
      {/*  )}*/}
      {/*</div>*/}
    </>
  );
};
