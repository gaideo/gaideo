import React, { useEffect, useRef, useState } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Slide from '@material-ui/core/Slide';
import { TransitionProps } from '@material-ui/core/transitions';
import { TextField } from '@material-ui/core';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children?: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});


interface CopyDialogResult {
  (): void
}

interface GetCopyText {
  (): Promise<string>
}

interface CopyDialogProps {
  open: boolean,
  title: string;
  getTextCallback: GetCopyText;
  onResult: CopyDialogResult
}

export default function ConfirmDialog(props: CopyDialogProps) {

  const [text, setText] = useState('');
  const copyInput = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    props.onResult();
  };

  const handleCopy = () => {
    const input: HTMLInputElement | null | undefined = copyInput?.current?.firstChild?.firstChild as HTMLInputElement;
    if (input) {
      input.select();
      input.setSelectionRange(0, 99999);
      document.execCommand("copy");    }
  }

  useEffect(() => {
    const loadText = async () => {
      if (props.getTextCallback) {
        const val = await props.getTextCallback();
        if (val) {
          setText(val);
        }
      }

    }
    loadText();
  }, [props]);

  return (
    <div>
      <Dialog
        open={props.open}
        TransitionComponent={Transition}
        keepMounted
        onClose={handleClose}
        aria-labelledby="alert-dialog-slide-title"
        aria-describedby="alert-dialog-slide-description"
      >
        <DialogTitle id="alert-dialog-slide-title">{props.title}</DialogTitle>
        <DialogContent>
        <TextField
              ref={copyInput}
              value={text}
              className="Input"
              inputProps={{ readOnly: true }}
            />
        </DialogContent>
        <DialogActions>
        <Button onClick={handleCopy} color="primary">
            Copy
          </Button>
          <Button onClick={handleClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
