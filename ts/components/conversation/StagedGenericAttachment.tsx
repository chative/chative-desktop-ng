import React from 'react';

import { AttachmentType, getExtensionForDisplay } from '../../types/Attachment';
import { LocalizerType } from '../../types/Util';
import MessageAttachmentFileShow from './MessageAttachmentFileShow';

interface Props {
  attachment: AttachmentType;
  onClose: (attachment: AttachmentType) => void;
  i18n: LocalizerType;
}

export class StagedGenericAttachment extends React.Component<Props> {
  public renderRegularFileShow(extension: string | undefined) {
    return <MessageAttachmentFileShow extension={extension} staged={true} />;
    // old code
    // <div className="module-staged-generic-attachment__icon">
    //   {extension ? (
    //     <div className="module-staged-generic-attachment__icon__extension">
    //       {extension}
    //     </div>
    //   ) : null}
    // </div>
  }

  public render() {
    const { attachment, onClose } = this.props;
    const { fileName, contentType } = attachment;
    const extension = getExtensionForDisplay({ contentType, fileName });

    return (
      <div className="module-staged-generic-attachment">
        <div
          className="module-staged-generic-attachment__close-button"
          role="button"
          onClick={() => {
            if (onClose) {
              onClose(attachment);
            }
          }}
        />
        {this.renderRegularFileShow(extension)}
        <div className="module-staged-generic-attachment__filename">
          {fileName}
        </div>
      </div>
    );
  }
}
