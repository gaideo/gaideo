import React, { useLayoutEffect, useState } from 'react';

export function useWindowSize(id: string | null = null) {
    const [size, setSize] = useState([0, 0]);
    useLayoutEffect(() => {
      function updateSize() {
          if (!id) {
            setSize([window.innerWidth, window.innerHeight]);
          }
          else {
              let elem = document.getElementById(id);
              if (elem) {
                  setSize([elem.clientWidth, elem.clientHeight]);
              }
          }
      }
      window.addEventListener('resize', updateSize);
      updateSize();
      return () => window.removeEventListener('resize', updateSize);
    }, []);
    return size;
  }
  