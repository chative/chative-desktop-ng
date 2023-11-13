export function getExternalFilesForMessage(message: any): Array<string> {
  const { attachments, contacts, quote, forwardContext } = message;
  const files: Array<string> = [];

  if (attachments?.length) {
    attachments.forEach(
      (attachment: { path: any; thumbnail: any; screenshot: any }) => {
        const { path: file, thumbnail, screenshot } = attachment;
        if (file) {
          files.push(file);
        }

        if (thumbnail && thumbnail.path) {
          files.push(thumbnail.path);
        }

        if (screenshot && screenshot.path) {
          files.push(screenshot.path);
        }
      }
    );
  }

  if (quote?.attachments?.length) {
    quote.attachments.forEach((attachment: { thumbnail: any }) => {
      const { thumbnail } = attachment;

      if (thumbnail && thumbnail.path) {
        files.push(thumbnail.path);
      }
    });
  }

  if (contacts?.length) {
    contacts.forEach((item: { avatar: any }) => {
      const { avatar } = item;

      if (avatar && avatar.avatar && avatar.avatar.path) {
        files.push(avatar.avatar.path);
      }
    });
  }

  const walkForward = (forwards: any) => {
    if (forwards instanceof Array) {
      forwards.forEach((forward: { forwards?: any; attachments?: any }) => {
        const { attachments: forwardAttachments } = forward;

        if (forwardAttachments instanceof Array) {
          forwardAttachments.forEach((attachment: any) => {
            const { path: file, thumbnail, screenshot } = attachment;
            if (file) {
              files.push(file);
            }

            if (thumbnail && thumbnail.path) {
              files.push(thumbnail.path);
            }

            if (screenshot && screenshot.path) {
              files.push(screenshot.path);
            }
          });
        }

        walkForward(forward.forwards);
      });
    }
  };

  const { forwards } = forwardContext || {};
  walkForward(forwards);

  return files;
}

export function getExternalFilesForConversation(
  conversation: any
): Array<string> {
  const { avatar, profileAvatar } = conversation;
  const files: Array<string> = [];

  if (avatar?.path) {
    files.push(avatar.path);
  }

  if (profileAvatar?.path) {
    files.push(profileAvatar.path);
  }

  return files;
}
