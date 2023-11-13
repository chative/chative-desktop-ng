import React from 'react';
import classNames from 'classnames';

import { Avatar } from '../Avatar';
import { Spinner } from '../Spinner';
import { MessageBody } from './MessageBody';
// import { ExpireTimer } from './ExpireTimer';
import { ImageGrid } from './ImageGrid';
import { Timestamp } from './Timestamp';
import { ContactName } from './ContactName';
import { Quote, QuotedAttachmentType } from './Quote';
import { EmbeddedContact } from './EmbeddedContact';
import EmbeddedTask, { TaskType } from './EmbeddedTask';
import EmbeddedPoll, { PollType } from './EmbeddedPoll';
import EmbeddedCard, { CardType } from './EmbeddedCard';
import { v4 as uuidv4 } from 'uuid';

import {
  canDisplayImage,
  getExtensionForDisplay,
  getGridDimensions,
  hasImage,
  hasVideoScreenshot,
  isAudio,
  isImage,
  isVideo,
} from '../../../ts/types/Attachment';
import { AttachmentType } from '../../types/Attachment';
import { Contact } from '../../types/Contact';

import { getIncrement } from '../../util/timer';
import { isFileDangerous } from '../../util/isFileDangerous';
import { ColorType, LocalizerType } from '../../types/Util';
import {
  ContextMenu,
  ContextMenuTrigger,
  MenuItem,
  SubMenu,
} from 'react-contextmenu';
import MessageAttachmentFileShow from './MessageAttachmentFileShow';
import { ForwardDialog } from '../ForwardDialog';
import { ForwardPreviewBody, ForwardedMessage } from './ForwardPreviewBody';
import { Language } from './TranslateMenu';
import { TaskDialog } from '../task/TaskDialog';
import moment from 'moment';
import { Tooltip, Popover } from 'antd';
import {
  ReactionContactList,
  Contact as ReactionContact,
} from './ReactionContactList';
import { CheckResult, RiskCheckDialog } from './RiskCheckDialog';

interface Trigger {
  handleContextClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

interface Reaction {
  emoji: string;
  contact: ReactionContact;
}

interface EmojiReaction {
  emoji: string;
  reactions: Array<Reaction>;
}

interface ReplyProps {
  text: string;
  attachment?: QuotedAttachmentType;
  isFromMe: boolean;
  authorPhoneNumber: string;
  authorProfileName?: string;
  authorName?: string;
  authorColor?: ColorType;
  onClick?: () => void;
  referencedMessageNotFound: boolean;
  isReply?: boolean;
  messageMode?: boolean;
}

export interface Props {
  leftGroup?: any;
  groupRapidRole?: number;
  memberRapidRole?: any;
  isOutside?: any;
  disableMenu?: boolean;
  text?: string;
  textPending?: boolean;
  checkUrlResult?: any;
  checkFileResult?: any;
  id?: string;
  collapseMetadata?: boolean;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  // What if changed this over to a single contact like quote, and put the events on it?
  contact?: Contact & {
    hasSignalAccount: boolean;
    onSendMessage?: () => void;
    onClick?: () => void;
  };
  task?: TaskType;
  vote?: PollType;
  card?: CardType;
  i18n: LocalizerType;
  authorId?: string;
  authorName?: string;
  authorProfileName?: string;
  /** Note: this should be formatted for display */
  authorPhoneNumber: string;
  authorColor?: ColorType;
  conversationType: 'group' | 'direct' | 'forward' | 'pin';
  conversationId?: string;
  attachments?: Array<AttachmentType>;
  quote?: ReplyProps;
  reply?: ReplyProps;
  authorAvatarPath?: string;
  isExpired: boolean;
  expirationLength?: number;
  expirationTimestamp?: number;
  readMemberCount: number;
  noShowDetail?: boolean;
  onClickAttachment?: (attachment: AttachmentType) => void;
  onReply?: () => void;
  onReplyOldMessageWithoutTopic?: () => void;
  onRetrySend?: () => void;
  onDownload?: (isDangerous: boolean) => void;
  onOpenFile?: () => void;
  onDelete?: () => void;
  onShowDetail: () => void;
  onDoubleClickAvatar?: () => void;
  onFetchAttachments?: () => void;
  ourNumber: string;
  withMenu?: boolean;
  addAtPerson?: (id: string) => void;
  onForwardTo?: (conversationIds?: Array<string>, isMerged?: boolean) => void;
  isSelected?: boolean;
  isSelectingMode?: boolean;
  isSelectDisabled?: boolean;
  onChangeMultiSelectingMode?: (isSelecting?: boolean) => void;
  onSelectChange?: (checked: boolean, shiftKey: boolean) => void;
  isSingleForward?: boolean;
  forwardedMessages?: Array<ForwardedMessage>;
  showForwordedMessageList?: (title: string, cid?: string) => void;
  onRecall?: () => void;
  isRecalled?: boolean;
  recallable?: boolean;
  recallableTimerLen?: number;
  recallableExpiredAt?: number;

  translating?: boolean;
  translateError?: boolean | string;
  translatedText?: string;
  translateLang?: string;
  translateOff?: string;
  onChangeTranslation?: (targetLang?: string) => void;
  supportedLanguages?: Array<Language>;
  atPersons?: string;
  mentions?: Array<any>;
  onCopyImage?: (attachment: AttachmentType) => void;
  showThreadBar?: boolean;
  threadId?: string;
  threadReplied?: boolean;
  threadProps?: any;
  topicReplied?: boolean;
  isUseTopicCommand?: boolean;
  isAtBotTopic?: boolean;
  firstMessageTopicFlag?: boolean;
  onShowThread?: () => void;
  onThreadReply?: () => void;
  onPin?: (pin: boolean) => void;
  pinId?: string;
  pinMessageJumpTo?: (
    source: string,
    sourceDevice: number,
    timestamp: number
  ) => void;
  pinMessageSource?: string;
  pinMessageSourceDevice?: number;
  pinMessageTimestamp?: number;
  hasReactions?: boolean;
  emojiReactions?: Array<EmojiReaction>;
  onClickReaction?: (emoji: string, mineReaction?: Reaction) => void;
  riskCheck?: () => void;
  getFileCheckResult: (sha256: string, size: number) => any;
  getUrlCheckResult: (url: string) => any;

  isConfidentialMessage?: boolean;
  onMouseOverMessage?: () => void;
}

interface State {
  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;

  conversations: any;
  showForwardDialog: boolean;
  showNewTaskDialog: boolean;
  randomTriggerId: string;
  recallableExpired: boolean;

  reactionMenuPopoverVisible: boolean;
  reactionButtonPopoverVisible: boolean;
  showRiskCheckDialog?: boolean;
  isOpenFile?: boolean;
  clickedFileHash?: string;
  checkFileResult?: any;
  onDownload?: () => void;

  isVisible: boolean;
  isMouseOver: boolean;
}

const EXPIRATION_CHECK_MINIMUM = 2000;
const EXPIRED_DELAY = 600;
const RECALLABLE_EXPIRATION_CHECK_MINIMUM = 60 * 1000;

export class Message extends React.PureComponent<Props, State> {
  public captureMenuTriggerBound: (trigger: any) => void;
  public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  public handleImageErrorBound: () => void;

  public captureTranslateMenuTriggerBound: (trigger: any) => void;
  public showTranslateMenuBound: (
    event: React.MouseEvent<HTMLDivElement>
  ) => void;

  public menuTriggerRef: Trigger | undefined;
  public translateMenuTriggerRef: Trigger | undefined;
  public expirationCheckInterval: any;
  public expiredTimeout: any;
  public audioRef: any;
  public audioAddListener: any;
  public recallableCheckInterval: any;
  public messageBodyDivRef: any;
  public isUnmount?: boolean;

  public observer: IntersectionObserver | undefined;
  public visibleChangeTimeout: NodeJS.Timeout | undefined;

  public constructor(props: Props) {
    super(props);

    this.captureMenuTriggerBound = this.captureMenuTrigger.bind(this);
    this.showMenuBound = this.showMenu.bind(this);
    this.captureTranslateMenuTriggerBound =
      this.captureTranslateMenuTrigger.bind(this);
    this.showTranslateMenuBound = this.showTranslateMenu.bind(this);
    this.handleImageErrorBound = this.handleImageError.bind(this);
    this.audioRef = React.createRef();

    this.messageBodyDivRef = React.createRef();

    this.state = {
      expiring: false,
      expired: false,
      imageBroken: false,

      conversations: [],
      showForwardDialog: false,
      showNewTaskDialog: false,
      randomTriggerId: uuidv4(),

      recallableExpired: false,

      reactionMenuPopoverVisible: false,
      reactionButtonPopoverVisible: false,
      showRiskCheckDialog: false,
      isOpenFile: false,
      clickedFileHash: '',
      isVisible: true,

      isMouseOver: false,
    };
  }

  public async componentDidMount() {
    this.setRecallableExpiredCheckInterval();
    this.setExpiredCheckInterval();

    this.observer = new IntersectionObserver(entries => {
      // should filter out reloaded element
      const validEntires = entries.filter(entry => !!entry.rootBounds);
      if (!validEntires.length) {
        return;
      }

      if (this.visibleChangeTimeout) {
        clearTimeout(this.visibleChangeTimeout);
        this.visibleChangeTimeout = undefined;
      }

      const isVisible = validEntires[0].isIntersecting;

      this.visibleChangeTimeout = setTimeout(() => {
        this.setState({ isVisible });
        this.visibleChangeTimeout = undefined;
      }, 500);
    });

    this.observer.observe(this.messageBodyDivRef.current);
  }

  public componentWillUnmount() {
    if (this.audioAddListener) {
      (window as any).removeEventListener(
        'message-audio-all-stop',
        this.stopAudioPlay
      );
    }

    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
    }

    if (this.expiredTimeout) {
      clearTimeout(this.expiredTimeout);
    }

    if (this.recallableCheckInterval) {
      clearInterval(this.recallableCheckInterval);
    }

    this.isUnmount = true;

    this.observer?.disconnect();

    if (this.visibleChangeTimeout) {
      clearTimeout(this.visibleChangeTimeout);
      this.visibleChangeTimeout = undefined;
    }
  }

  public componentDidUpdate() {
    this.checkExpired();
    this.checkRecallableExpired();
  }

  public setExpiredCheckInterval() {
    const { expirationLength } = this.props;

    if (!expirationLength) {
      return;
    }

    const increment = getIncrement(expirationLength);
    const checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);

    this.checkExpired();

    this.expirationCheckInterval = setInterval(() => {
      this.checkExpired();
    }, checkFrequency);
  }

  public checkExpired() {
    const now = Date.now();
    const { isExpired, expirationTimestamp, expirationLength } = this.props;

    if (!expirationTimestamp || !expirationLength) {
      return;
    }
    if (this.expiredTimeout) {
      return;
    }

    if (isExpired || now >= expirationTimestamp) {
      this.setState({
        expiring: true,
      });

      const setExpired = () => {
        if (this.isUnmount) {
          return;
        }

        this.setState({
          expired: true,
        });
      };
      this.expiredTimeout = setTimeout(setExpired, EXPIRED_DELAY);
    }
  }

  public setRecallableExpiredCheckInterval() {
    const { recallableTimerLen, recallable } = this.props;

    if (!recallableTimerLen || !recallable) {
      return;
    }

    const increment = getIncrement(recallableTimerLen);
    const checkFrequency = Math.max(
      RECALLABLE_EXPIRATION_CHECK_MINIMUM,
      increment
    );

    this.checkRecallableExpired();

    this.recallableCheckInterval = setInterval(() => {
      this.checkRecallableExpired();
    }, checkFrequency);
  }

  public checkRecallableExpired() {
    const { recallable, recallableExpiredAt, direction, status } = this.props;

    if (
      !recallable ||
      direction !== 'outgoing' ||
      status === 'sending' ||
      status === 'error'
    ) {
      return;
    }

    if (!recallableExpiredAt) {
      return;
    }

    if (this.state.recallableExpired) {
      return;
    }

    const delta = recallableExpiredAt - Date.now();
    if (delta <= 0) {
      this.setState({
        recallableExpired: true,
      });

      if (this.recallableCheckInterval) {
        clearInterval(this.recallableCheckInterval);
        this.recallableCheckInterval = null;
      }
    }
  }

  public audioWillPlay = () => {
    if (!this.audioAddListener) {
      this.audioAddListener = true;
      (window as any).addEventListener(
        'message-audio-all-stop',
        this.stopAudioPlay
      );
    }

    const ev = new CustomEvent('message-audio-all-stop', {
      detail: this.audioRef.current.innerHTML,
    });
    (window as any).dispatchEvent(ev);
  };

  public stopAudioPlay = (event: any) => {
    if (
      this.audioRef.current &&
      event.detail !== this.audioRef.current.innerHTML
    ) {
      this.audioRef.current.pause();
      this.audioRef.current.currentTime = 0;
    }
  };

  public handleImageError() {
    // tslint:disable-next-line no-console
    console.log('Message: Image failed to load; failing over to placeholder');
    this.setState({
      imageBroken: true,
    });
  }

  public renderErrorText() {
    const { i18n, isRecalled } = this.props;

    let errorMessage = 'sendFailed';

    if (isRecalled) {
      errorMessage = 'recallFailed';
    }

    return i18n(errorMessage);
  }

  public renderReplyThreadButton() {
    const {
      direction,
      showThreadBar,
      onThreadReply,
      threadProps,
      conversationType,
      i18n,
    } = this.props;

    if (conversationType === 'direct') {
      return null;
    }

    if (!showThreadBar || !threadProps) {
      return null;
    }

    if (
      // threadProps.replyToUser ||
      !threadProps.replyToUser &&
      threadProps.topicId === undefined &&
      direction === 'outgoing'
    ) {
      return null;
    }

    return (
      <div
        role="button"
        className={classNames(
          direction === 'outgoing' && threadProps.topicId
            ? 'module-message__topic-reply-button'
            : 'module-message__thread-reply-button'
        )}
        style={{
          marginLeft:
            direction === 'outgoing' &&
            (threadProps.topicId || !threadProps.topicId)
              ? '10px'
              : '',
          fontSize: '10px',
          lineHeight:
            direction === 'outgoing' &&
            (threadProps.topicId || !threadProps.topicId)
              ? 'normal'
              : '',
        }}
        onClick={onThreadReply}
      >
        {i18n('replyButton')}
      </div>
    );
  }

  public renderBottomBar() {
    const { direction } = this.props;

    return (
      <div className={`module-message__bottom-bar--${direction}`}>
        {direction === 'incoming' ? this.renderReplyThreadButton() : null}
        {this.renderMetadata()}
      </div>
    );
  }

  public renderMetadata() {
    const {
      attachments,
      collapseMetadata,
      direction,
      // expirationLength,
      // expirationTimestamp,
      i18n,
      status,
      // text,
      textPending,
      timestamp,
      noShowDetail,
      onShowDetail,
      readMemberCount,
      onChangeMultiSelectingMode,
      conversationType,
    } = this.props;
    const { imageBroken } = this.state;

    if (collapseMetadata) {
      return null;
    }

    const canDisplayAttachment = canDisplayImage(attachments);
    const withImageNoCaption = Boolean(
      false &&
        canDisplayAttachment &&
        !imageBroken &&
        ((isImage(attachments) && hasImage(attachments)) ||
          (isVideo(attachments) && hasVideoScreenshot(attachments)))
    );
    const showError = status === 'error' && direction === 'outgoing';
    return (
      <div
        className={classNames(
          'module-message__metadata',
          withImageNoCaption
            ? 'module-message__metadata--with-image-no-caption'
            : null
        )}
        onClick={event => {
          if (event.shiftKey) {
            if (onChangeMultiSelectingMode && !noShowDetail) {
              onChangeMultiSelectingMode(true);
            }
          }
        }}
      >
        {showError ? (
          <span
            className={classNames(
              'module-message__metadata__date',
              `module-message__metadata__date--${direction}`,
              withImageNoCaption
                ? 'module-message__metadata__date--with-image-no-caption'
                : null
            )}
          >
            {this.renderErrorText()}
          </span>
        ) : (
          <Timestamp
            i18n={i18n}
            timestamp={timestamp}
            extended={true}
            direction={direction}
            withImageNoCaption={withImageNoCaption}
            module={'module-message__metadata__date'}
          />
        )}
        {/* {expirationLength && expirationTimestamp ? (
          <ExpireTimer
            direction={direction}
            expirationLength={expirationLength}
            expirationTimestamp={expirationTimestamp}
            withImageNoCaption={withImageNoCaption}
          />
        ) : null} */}
        {direction === 'outgoing' ? this.renderReplyThreadButton() : null}
        {direction === 'incoming' ? null : (
          <span className="module-message__metadata__spacer" />
        )}
        {textPending ? (
          <div className="module-message__metadata__spinner-container">
            <Spinner size="mini" direction={direction} />
          </div>
        ) : null}
        {!textPending &&
        direction === 'outgoing' &&
        status !== 'error' &&
        conversationType !== 'pin' ? (
          <div className="module-message__metadata__status-new-icon--wrapper">
            <div
              className={classNames(
                'module-message__metadata__status-icon',
                status === 'sending'
                  ? 'module-message__metadata__status-icon--sending'
                  : readMemberCount === Number.MAX_VALUE
                  ? 'module-message__metadata__status-new-icon--read'
                  : readMemberCount > 99
                  ? 'module-message__metadata__status-new-icon--read-exceed'
                  : 'module-message__metadata__status-new-icon--read-count',
                withImageNoCaption
                  ? 'module-message__metadata__status-icon--with-image-no-caption'
                  : null
              )}
              onClick={noShowDetail ? () => {} : onShowDetail}
              style={noShowDetail ? {} : { cursor: 'pointer' }}
            />
            {readMemberCount <= 99 &&
            readMemberCount > 0 &&
            status !== 'sending' ? (
              <div
                className={classNames(
                  'module-message__metadata__status-text--read-count'
                )}
              >
                {readMemberCount}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  public renderAuthor() {
    const {
      authorName,
      authorPhoneNumber,
      authorProfileName,
      conversationType,
      direction,
      i18n,
      groupRapidRole,
      isOutside,
    } = this.props;

    const title = authorName ? authorName : authorPhoneNumber;

    if (
      (conversationType !== 'forward' && direction !== 'incoming') ||
      !title
    ) {
      return null;
    }

    return (
      <>
        <div className="module-message__author">
          <ContactName
            phoneNumber={authorPhoneNumber}
            name={authorName}
            profileName={authorProfileName}
            module="module-message__author"
            i18n={i18n}
            groupRapidRole={groupRapidRole}
            isOutside={isOutside}
            inMessage
          />
        </div>
      </>
    );
  }

  public renderRegularFileShow(extension: string | undefined) {
    return <MessageAttachmentFileShow extension={extension} />;
    // old code
    // return <div className="module-message__generic-attachment__icon">
    //   {extension ? (
    //     <div className="module-message__generic-attachment__icon__extension">
    //       {extension}
    //     </div>
    //   ) : null}
    // </div>
  }

  // tslint:disable-next-line max-func-body-length cyclomatic-complexity
  public renderAttachment() {
    const {
      attachments,
      // text,
      collapseMetadata,
      conversationType,
      direction,
      i18n,
      quote,
      onClickAttachment,
      onFetchAttachments,
      isConfidentialMessage,
      isSingleForward,
      threadProps,
      onOpenFile,
      // getFileCheckResult,
    } = this.props;
    const { imageBroken } = this.state;

    if (!attachments || !attachments[0]) {
      return null;
    }
    const firstAttachment = attachments[0];

    const { replyToUser, quotedUser } = threadProps || {};

    // For attachments which aren't full-frame
    const withContentBelow = true;
    const withContentAbove =
      Boolean(quote) ||
      conversationType === 'forward' ||
      direction === 'incoming' ||
      Boolean(isSingleForward) ||
      (replyToUser && quotedUser);

    const displayImage = canDisplayImage(attachments);

    const shouldHide = isConfidentialMessage && !this.state.isMouseOver;

    if (
      displayImage &&
      !imageBroken &&
      ((isImage(attachments) && hasImage(attachments)) ||
        (isVideo(attachments) && hasVideoScreenshot(attachments)))
    ) {
      return (
        <div style={shouldHide ? { background: '#B7BDC6' } : {}}>
          <div
            className={classNames(
              'module-message__attachment-container',
              withContentAbove
                ? 'module-message__attachment-container--with-content-above'
                : null,
              withContentBelow
                ? 'module-message__attachment-container--with-content-below'
                : null
            )}
            style={shouldHide ? { visibility: 'hidden' } : {}}
          >
            <ImageGrid
              attachments={attachments}
              withContentAbove={withContentAbove}
              withContentBelow={withContentBelow}
              bottomOverlay={!collapseMetadata}
              i18n={i18n}
              onError={this.handleImageErrorBound}
              onClickAttachment={onClickAttachment}
              onFetchAttachments={onFetchAttachments}
            />
          </div>
        </div>
      );
    } else if (
      !firstAttachment.pending &&
      isAudio(attachments) &&
      !firstAttachment.fetchError
    ) {
      return (
        <div style={shouldHide ? { background: '#B7BDC6' } : {}}>
          <audio
            ref={this.audioRef}
            controls={true}
            className={classNames(
              'module-message__audio-attachment',
              withContentBelow
                ? 'module-message__audio-attachment--with-content-below'
                : null,
              withContentAbove
                ? 'module-message__audio-attachment--with-content-above'
                : null
            )}
            key={firstAttachment.url}
            onPlay={this.audioWillPlay}
            style={shouldHide ? { visibility: 'hidden' } : {}}
          >
            <source src={firstAttachment.url} />
          </audio>
        </div>
      );
    } else {
      const {
        pending,
        fileName,
        fileSize,
        contentType,
        fetchError,
        error,
        // sha256,
        // size,
      } = firstAttachment;

      const extension = getExtensionForDisplay({ contentType, fileName });
      const isDangerous = isFileDangerous(fileName || '');
      return (
        <div style={shouldHide ? { background: '#B7BDC6' } : {}}>
          <div
            className={classNames(
              'module-message__generic-attachment',
              withContentBelow
                ? 'module-message__generic-attachment--with-content-below'
                : null,
              withContentAbove
                ? 'module-message__generic-attachment--with-content-above'
                : null
            )}
            onClick={async () => {
              if (error || pending || fetchError) {
                return;
              }

              // disable RiskCheckDialog
              if (onOpenFile) {
                onOpenFile();
              }

              // if (sha256 && size) {
              //   const result = await getFileCheckResult(sha256, size);
              //   if (result.status === 1) {
              //     onOpenFile && onOpenFile();
              //   } else {
              //     this.setState({
              //       isOpenFile: true,
              //       showRiskCheckDialog: true,
              //       clickedFileHash: sha256,
              //       checkFileResult: result,
              //     });
              //   }
              // }
            }}
            style={shouldHide ? { visibility: 'hidden' } : {}}
          >
            {error ? (
              <div className="module-message__generic-attachment__permanent-error-container">
                <div className="module-message__generic-attachment__permanent-error">
                  X
                </div>
              </div>
            ) : pending ? (
              <div className="module-message__generic-attachment__spinner-container">
                <Spinner size="small" direction={direction} />
              </div>
            ) : fetchError ? (
              <div className="module-message__generic-attachment__fetch-error-container">
                <div
                  className="module-message__generic-attachment__fetch-error"
                  onClick={onFetchAttachments}
                ></div>
              </div>
            ) : (
              <div className="module-message__generic-attachment__icon-container">
                {this.renderRegularFileShow(extension)}
                {isDangerous ? (
                  <div className="module-message__generic-attachment__icon-dangerous-container">
                    <div className="module-message__generic-attachment__icon-dangerous" />
                  </div>
                ) : null}
              </div>
            )}
            <div className="module-message__generic-attachment__text">
              <div
                className={classNames(
                  'module-message__generic-attachment__file-name',
                  `module-message__generic-attachment__file-name--${direction}`
                )}
              >
                {fileName}
              </div>
              <div
                className={classNames(
                  'module-message__generic-attachment__file-size',
                  `module-message__generic-attachment__file-size--${direction}`
                )}
              >
                {fileSize}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  public renderRiskCheckDialog() {
    const { /*checkFileResult,*/ i18n, onOpenFile } = this.props;
    const { showRiskCheckDialog, checkFileResult, isOpenFile, onDownload } =
      this.state;

    if (!showRiskCheckDialog) {
      return;
    }

    let checkResult: CheckResult;
    if (checkFileResult) {
      checkResult = {
        ...checkFileResult,
      };
    } else {
      checkResult = {
        status: 1,
        reason: i18n('greyFile'),
      };
    }

    // const checkResultMap = this.objChangeMap(checkFileResult);

    return (
      <>
        <RiskCheckDialog
          checkResult={checkResult}
          onClose={() => {
            window.removeEventListener('check-file-completed', () => {});
            this.setState({
              isOpenFile: false,
              showRiskCheckDialog: false,
              onDownload: undefined,
            });
          }}
          showRiskCheckDialog={showRiskCheckDialog}
          i18n={i18n}
          onDoAlways={() => {
            if (onOpenFile && isOpenFile) {
              this.setState({
                showRiskCheckDialog: false,
              });
              onOpenFile();
            } else if (onDownload) {
              this.setState({
                showRiskCheckDialog: false,
                onDownload: undefined,
              });
              onDownload();
            }
          }}
        ></RiskCheckDialog>
      </>
    );
  }

  public renderReplyHeader() {
    const {
      i18n,
      direction,
      threadProps,
      isUseTopicCommand,
      firstMessageTopicFlag,
      isAtBotTopic,
      conversationType,
      attachments,
      forwardedMessages,
      task,
      vote,
    } = this.props;

    if (!threadProps) {
      return null;
    }
    if (conversationType === 'direct') {
      return null;
    }

    //replyToUser,
    const {
      replyToUser,
      quotedUser,
      topicId,
      replyTopicMessageHeader,
      botId,
      firstBotName,
      supportType,
    } = threadProps;
    if (!quotedUser) {
      return null;
    }

    const { isFromMe, authorPhoneNumber, authorName } = quotedUser;
    if (replyToUser) {
      if (supportType === 0) {
        return (
          <div className={classNames(`module-message__reply-to--${direction}`)}>
            {i18n('replyFromBotHeader', [firstBotName || botId])}
          </div>
        );
      }
      return (
        <div className={classNames(`module-message__reply-to--${direction}`)}>
          {i18n('replyToHeader', [
            isFromMe ? i18n('you') : authorName || authorPhoneNumber,
          ])}
        </div>
      );
    } else if (!replyToUser && supportType === 1) {
      return null;
    } else if (!botId) {
      return (
        <div
          className={classNames(
            `module-message__reply-to--${direction}`,
            attachments && attachments?.length > 0 && direction === 'outgoing'
              ? 'module-message__reply-to--outgoing-attachment'
              : 'module-message__reply-to--outgoing-no_attachment',
            (forwardedMessages && forwardedMessages?.length > 1) ||
              task ||
              vote ||
              direction === 'incoming'
              ? 'module-message__reply-to--outgoing-special-type'
              : 'module-message__reply-to--outgoing-no-special-type'
          )}
        >
          {isUseTopicCommand || !!firstMessageTopicFlag
            ? i18n('topicHeader')
            : topicId
            ? i18n('replyTopicHeader') + replyTopicMessageHeader
            : null}
        </div>
      );
    } else if (botId && topicId) {
      return (
        <div
          className={classNames(
            `module-message__reply-to--${direction}`,
            attachments && attachments?.length > 0 && direction === 'outgoing'
              ? 'module-message__reply-to--outgoing-attachment'
              : 'module-message__reply-to--outgoing-no_attachment'
          )}
        >
          {isAtBotTopic
            ? i18n('atBotTopicHeader', [
                firstBotName ? firstBotName + ':' : botId + ':',
              ])
            : i18n('replyAtBotTopicHeader', [
                firstBotName ? firstBotName + ':' : botId + ':',
              ])}
        </div>
      );
    } else {
      return null;
    }
  }

  public renderQuote() {
    const {
      // conversationType,
      authorColor,
      direction,
      i18n,
      quote,
      threadProps,
      reply,
    } = this.props;

    if (!quote && !threadProps) {
      return null;
    }

    const withContentAbove = direction === 'incoming';

    if (quote) {
      const quoteColor =
        direction === 'incoming' ? authorColor : quote.authorColor;

      return (
        <Quote
          i18n={i18n}
          onClick={quote.onClick}
          text={quote.text}
          attachment={quote.attachment}
          isIncoming={direction === 'incoming'}
          authorPhoneNumber={quote.authorPhoneNumber}
          authorProfileName={quote.authorProfileName}
          authorName={quote.authorName}
          authorColor={quoteColor}
          referencedMessageNotFound={quote.referencedMessageNotFound}
          isFromMe={quote.isFromMe}
          withContentAbove={withContentAbove}
          messageMode={quote.messageMode}
        />
      );
    } else if (reply) {
      const replyColor =
        direction === 'incoming' ? authorColor : reply.authorColor;
      return (
        <Quote
          i18n={i18n}
          onClick={reply.onClick}
          text={reply.text}
          attachment={reply.attachment}
          isIncoming={direction === 'incoming'}
          authorPhoneNumber={reply.authorPhoneNumber}
          authorProfileName={reply.authorProfileName}
          authorName={reply.authorName}
          authorColor={replyColor}
          referencedMessageNotFound={reply.referencedMessageNotFound}
          isFromMe={reply.isFromMe}
          withContentAbove={withContentAbove}
          isReply={reply.isReply}
        />
      );
    } else {
      return null;
    }
  }

  public objChangeMap = (obj: { [x: string]: any }) => {
    let map = new Map();
    for (let key in obj) {
      map.set(key, obj[key]);
    }
    return map;
  };

  public renderEmbeddedContact() {
    const {
      collapseMetadata,
      contact,
      // conversationType,
      direction,
      authorId,
      i18n,
      text,
    } = this.props;
    if (!contact) {
      return null;
    }
    const withCaption = Boolean(text);
    const withContentAbove = direction === 'incoming';
    const withContentBelow = withCaption || !collapseMetadata;

    return (
      <EmbeddedContact
        shareId={authorId}
        contact={contact}
        hasSignalAccount={contact.hasSignalAccount}
        isIncoming={direction === 'incoming'}
        i18n={i18n}
        onClick={contact.onClick}
        withContentAbove={withContentAbove}
        withContentBelow={withContentBelow}
      />
    );
  }

  public renderTask() {
    const { task, i18n, ourNumber, conversationId } = this.props;
    if (!task) {
      return null;
    }

    return (
      <EmbeddedTask
        i18n={i18n}
        task={task}
        ourNumber={ourNumber}
        conversationId={conversationId}
      />
    );
  }

  public renderPoll() {
    const { vote, i18n, ourNumber, memberRapidRole } = this.props;
    if (!vote) {
      return null;
    }

    return (
      <EmbeddedPoll
        i18n={i18n}
        poll={vote}
        ourNumber={ourNumber}
        memberRapidRole={memberRapidRole}
      />
    );
  }

  public renderCard() {
    const {
      i18n,
      direction,
      status,
      card,
      textPending,
      mentions,
      getUrlCheckResult,
      isConfidentialMessage,
    } = this.props;
    const type = card?.contentType as any;
    const contents = i18n('unsupportedMessageTip');
    if (!type || type === 0) {
      return (
        <EmbeddedCard
          i18n={i18n}
          card={card}
          conversationId={this.props.conversationId}
          getUrlCheckResult={getUrlCheckResult}
        />
      );
    } else {
      return (
        <div
          dir="auto"
          className={classNames(
            'module-message__text',
            `module-message__text--${direction}`,
            status === 'error' && direction === 'incoming'
              ? 'module-message__text--error'
              : null
          )}
        >
          <MessageBody
            text={contents || ''}
            isMouseOver={this.state.isMouseOver}
            isConfidentialMessage={isConfidentialMessage}
            mentions={mentions}
            i18n={i18n}
            textPending={textPending}
            getUrlCheckResult={getUrlCheckResult}
          />
        </div>
      );
    }
  }

  public renderSendMessageButton() {
    const { contact, i18n, conversationType } = this.props;
    if (
      !contact ||
      !contact.hasSignalAccount ||
      conversationType === 'forward' ||
      conversationType === 'pin'
    ) {
      return null;
    }

    return (
      <div
        role="button"
        onClick={contact.onSendMessage}
        className="module-message__send-message-button"
      >
        {i18n('sendMessageToContact')}
      </div>
    );
  }

  public renderAvatar() {
    const {
      authorId,
      authorAvatarPath,
      authorName,
      authorProfileName,
      collapseMetadata,
      authorColor,
      // conversationType,
      direction,
      i18n,
      onDoubleClickAvatar,
      withMenu,
      addAtPerson,
      groupRapidRole,
      authorPhoneNumber,
      conversationId,
      leftGroup,
    } = this.props;

    // if (
    //   collapseMetadata ||
    //   conversationType !== 'group' ||
    //   direction === 'outgoing'
    // ) {
    //   return;
    // }

    if (collapseMetadata) {
      return;
    }

    const theClass =
      direction === 'outgoing'
        ? 'module-message__author-avatar-right'
        : 'module-message__author-avatar';
    return (
      <div className={theClass}>
        <Avatar
          id={authorId}
          avatarPath={authorAvatarPath}
          color={authorColor}
          conversationType="direct"
          i18n={i18n}
          name={authorName}
          profileName={authorProfileName}
          size={36}
          onDoubleClickAvatar={onDoubleClickAvatar}
          withMenu={withMenu}
          addAtPerson={addAtPerson}
          groupRapidRole={groupRapidRole}
          direction={direction}
          authorPhoneNumber={authorPhoneNumber}
          conversationId={conversationId}
          leftGroup={leftGroup}
        />
      </div>
    );
  }

  public renderPinIcon() {
    const { pinId, direction, forwardedMessages } = this.props;
    if (!pinId) {
      return null;
    }

    const isMultipleForward = forwardedMessages && forwardedMessages.length > 1;

    let top = direction === 'incoming' && isMultipleForward ? 34 : 2;
    let backgroundColor;
    if (direction === 'outgoing' && isMultipleForward) {
      top = 6;
      backgroundColor = '#888888';
    }
    return (
      <span
        className={classNames(
          'module-message__pin--icon',
          `module-message__pin--icon--${direction}`
        )}
        style={{ top, backgroundColor }}
      />
    );
  }

  public renderText() {
    const {
      text,
      textPending,
      i18n,
      direction,
      status,
      contact,
      vote,
      task,
      isConfidentialMessage,
      card,
      isSingleForward,
      forwardedMessages,
      checkUrlResult,
      mentions,
      getUrlCheckResult,
    } = this.props;

    const contents =
      direction === 'incoming' && status === 'error'
        ? i18n('incomingError')
        : text;

    if (!contents) {
      return null;
    }

    // contact/task/vote/card message has no text body.
    if (contact || task || vote || card) {
      return null;
    }

    if (forwardedMessages && forwardedMessages.length > 0) {
      if (isSingleForward && forwardedMessages[0].card) {
        return null;
      }
    }
    const checkResultMap = this.objChangeMap(checkUrlResult);
    let singleForwardMentions;
    if (isSingleForward && forwardedMessages && forwardedMessages.length > 0) {
      singleForwardMentions = forwardedMessages[0].mentions;
    }

    return (
      <div
        dir="auto"
        className={classNames(
          'module-message__text',
          `module-message__text--${direction}`,
          status === 'error' && direction === 'incoming'
            ? 'module-message__text--error'
            : null
        )}
      >
        <MessageBody
          text={contents || ''}
          isMouseOver={this.state.isMouseOver}
          isConfidentialMessage={isConfidentialMessage}
          mentions={singleForwardMentions || mentions}
          i18n={i18n}
          textPending={textPending}
          checkUrlResult={checkResultMap}
          getUrlCheckResult={getUrlCheckResult}
          // noRequiredRiskCheck={noRequiredRiskCheck}
        />
      </div>
    );
  }

  public renderMenuReactionButton(
    emojiReaction: EmojiReaction,
    closePopover: () => void
  ) {
    const { onClickReaction } = this.props;

    const { emoji, reactions } = emojiReaction;
    const mineReaction = reactions.find(reaction => reaction.contact?.isMe);

    return (
      <button
        className={classNames(
          'module-message__reaction-menu-button',
          `module-message__reaction-menu-button--${
            mineReaction ? 'with-self' : 'with-none'
          }`
        )}
        key={emoji}
        onClick={() => {
          if (onClickReaction) {
            onClickReaction(emoji, mineReaction);
            closePopover();
          }
        }}
      >
        {emoji}
      </button>
    );
  }

  public renderEmojiReactionContactList(contacts: Array<ReactionContact>) {
    const { i18n } = this.props;
    return (
      <ReactionContactList
        contacts={contacts}
        i18n={i18n}
      ></ReactionContactList>
    );
  }

  public renderMessageReactionButton(emojiReaction: EmojiReaction) {
    const { onClickReaction, direction } = this.props;

    const { emoji, reactions } = emojiReaction;
    if (!reactions.length) {
      return null;
    }

    const length = reactions.length;
    const emojiWithNumberTitle = `${emoji} (${length})`;
    const emojiWithNumberButtonTitle =
      length === 1
        ? `${emoji} ${reactions[0].contact.name}`
        : `${emoji} ${length > 999 ? '999+' : length}`;

    const contacts = reactions.map(reaction => reaction.contact);
    const mineReaction = reactions.find(reaction => reaction.contact?.isMe);

    return (
      <Popover
        key={emoji}
        mouseEnterDelay={1}
        content={this.renderEmojiReactionContactList(contacts)}
        title={emojiWithNumberTitle}
        overlayClassName={'module-message__reaction-list-popover'}
      >
        <button
          className={classNames(
            'module-message__reaction-button',
            `module-message__reaction-button--${direction}`,
            `module-message__reaction-button--${
              mineReaction ? 'with-self' : 'with-others'
            }--${direction}`
          )}
          key={emoji}
          onClick={() => {
            if (onClickReaction) {
              onClickReaction(emoji, mineReaction);
            }
          }}
        >
          {emojiWithNumberButtonTitle}
        </button>
      </Popover>
    );
  }

  public renderMessageReactions() {
    const { hasReactions, emojiReactions, direction } = this.props;

    if (!hasReactions || !emojiReactions?.length) {
      return;
    }

    return (
      <div
        className={classNames(
          'module-message__reaction',
          `module-message__reaction--${direction}`
        )}
      >
        {emojiReactions.map(this.renderMessageReactionButton.bind(this))}
      </div>
    );
  }

  public renderTranslateText() {
    const {
      i18n,
      direction,
      status,
      translateLang,
      translatedText,
      translating,
      translateError,
      isConfidentialMessage,
      onChangeTranslation,
      getUrlCheckResult,
    } = this.props;

    if (direction === 'incoming' && status === 'error') {
      return null;
    }

    if (translating) {
      return (
        <div className="module-message__warning__status">
          <div
            className={classNames(
              'module-message__warning__status_translating--icon',
              `module-message__warning__status_translating--icon--${direction}`
            )}
          ></div>
          <span>{i18n('translating')}</span>
        </div>
      );
    }

    if (translateError) {
      let errorTemplate = 'translateFailed';
      if (typeof translateError === 'string') {
        errorTemplate = translateError;
      }

      return (
        <div className="module-message__warning__status">
          <div
            className={classNames(
              'module-message__warning__status_translate_failed--icon'
            )}
            onClick={() => {
              if (onChangeTranslation) {
                onChangeTranslation(translateLang);
              }
            }}
          ></div>
          <span>{i18n(errorTemplate)}</span>
        </div>
      );
    }

    if (translateLang && translatedText) {
      return (
        <div
          dir="auto"
          className={classNames(
            'module-message__translate__text',
            `module-message__translate__text--${direction}`
          )}
        >
          <MessageBody
            text={translatedText}
            isMouseOver={this.state.isMouseOver}
            isConfidentialMessage={isConfidentialMessage}
            i18n={i18n}
            textPending={false}
            getUrlCheckResult={getUrlCheckResult}
          />
        </div>
      );
    }

    return null;
  }

  public renderForwardedMessage() {
    const {
      forwardedMessages,
      i18n,
      showForwordedMessageList,
      isSingleForward,
      conversationId,
      direction,
      textPending,
      mentions,
      getUrlCheckResult,
      // checkUrlResult,
      isConfidentialMessage,
    } = this.props;
    const contents = i18n('unsupportedMessageTip');
    if (!forwardedMessages || forwardedMessages.length < 1) {
      return null;
    }

    if (isSingleForward) {
      if (forwardedMessages[0].card) {
        if (
          !forwardedMessages[0].card?.contentType ||
          forwardedMessages[0].card?.contentType === 0
        ) {
          return (
            <EmbeddedCard
              i18n={i18n}
              card={forwardedMessages[0].card}
              conversationId={conversationId}
              getUrlCheckResult={getUrlCheckResult}
            />
          );
        } else {
          return (
            <div
              dir="auto"
              className={classNames(
                'module-message__text',
                `module-message__text--${direction}`,
                status === 'error' && direction === 'incoming'
                  ? 'module-message__text--error'
                  : null
              )}
            >
              <MessageBody
                text={contents || ''}
                isMouseOver={this.state.isMouseOver}
                isConfidentialMessage={isConfidentialMessage}
                mentions={mentions}
                i18n={i18n}
                textPending={textPending}
                getUrlCheckResult={getUrlCheckResult}
              />
            </div>
          );
        }
      }
      return null;
    }

    return (
      <ForwardPreviewBody
        isMouseOver={this.state.isMouseOver}
        isConfidentialMessage={isConfidentialMessage}
        key={forwardedMessages[0].timestamp}
        i18n={i18n}
        forwardedMessages={forwardedMessages}
        onClick={showForwordedMessageList}
        conversationId={conversationId}
      />
    );
  }

  public renderError(isCorrectSide: boolean) {
    const { status, direction } = this.props;

    if (!isCorrectSide || status !== 'error') {
      return null;
    }

    return (
      <div className="module-message__error-container">
        <div
          className={classNames(
            'module-message__error',
            `module-message__error--${direction}`
          )}
          onClick={this.showMenuBound}
        />
      </div>
    );
  }

  public captureMenuTrigger(triggerRef: Trigger) {
    this.menuTriggerRef = triggerRef;
  }

  public showMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (this.menuTriggerRef) {
      this.menuTriggerRef.handleContextClick(event);
    }
  }

  public captureTranslateMenuTrigger(triggerRef: Trigger) {
    this.translateMenuTriggerRef = triggerRef;
  }

  public showTranslateMenu(event: React.MouseEvent<HTMLDivElement>) {
    const { translateLang, translateOff, onChangeTranslation } = this.props;

    if (
      translateLang &&
      translateLang !== translateOff &&
      onChangeTranslation
    ) {
      onChangeTranslation(translateOff);
    } else {
      if (this.translateMenuTriggerRef) {
        this.translateMenuTriggerRef.handleContextClick(event);
      }
    }
  }
  public onForwardMessage = async () => {
    this.setState({
      showForwardDialog: true,
      conversations: (window as any).getAliveConversationsProps(),
    });
  };

  public onForwardMessageToMe = () => {
    const { onForwardTo, ourNumber } = this.props;
    if (onForwardTo && ourNumber) {
      onForwardTo([ourNumber], true);
    }
  };

  public onNewTask = async () => {
    const { i18n, conversationId, conversationType } = this.props;
    if (conversationId && conversationType === 'group') {
      const group = (window as any).ConversationController.get(conversationId);
      if (group && !group.isMeCanSpeak()) {
        (window as any).noticeWithoutType(i18n('unSpeak'));
      } else {
        this.setState({ showNewTaskDialog: true });
      }
    } else {
      this.setState({ showNewTaskDialog: true });
    }
  };

  public closeNewTaskDialog = () => {
    this.setState({ showNewTaskDialog: false });
  };

  public isAttachmentsReady(attachments: Array<AttachmentType>) {
    let ready: boolean = true;

    if (attachments) {
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];

        if (
          attachment &&
          (attachment.pending || attachment.fetchError || attachment.error)
        ) {
          ready = false;
          break;
        }
      }
    }

    return ready;
  }

  public renderMenu(isCorrectSide: boolean, triggerId: string) {
    const {
      // i18n,
      attachments,
      direction,
      disableMenu,
      onDownload,
      onReply,
      status,
      conversationType,
      forwardedMessages,
      // onRecall,
      // recallable,
      // recallableExpiredAt,
      text,
      // translateLang,
      onChangeTranslation,
      supportedLanguages,
      task,
      vote,
      contact,
      pinMessageJumpTo,
      pinMessageSource,
      pinMessageSourceDevice,
      pinMessageTimestamp,
      i18n,
      emojiReactions,
      // getFileCheckResult,
      showThreadBar,
      // threadProps,
      // onThreadReply,
      // onReplyOldMessageWithoutTopic,
      isConfidentialMessage,
    } = this.props;

    if (!isCorrectSide || disableMenu) {
      return null;
    }

    const fileName =
      attachments && attachments[0] ? attachments[0].fileName : null;
    const isDangerous = isFileDangerous(fileName || '');
    const multipleAttachments = attachments && attachments.length > 1;
    const firstAttachment = attachments && attachments[0];
    // const sha256 = firstAttachment?.sha256;
    // const size = firstAttachment?.size;

    // const { recallableExpired } = this.state;

    // const showRecallMenuItem = (
    //   status !== 'error' &&
    //   status !== 'sending' &&
    //   recallable &&
    //   !recallableExpired &&
    //   direction === 'outgoing' &&
    //   recallableExpiredAt
    // );

    const showTranslateMenuItem =
      text &&
      text.length > 0 &&
      onChangeTranslation &&
      supportedLanguages &&
      supportedLanguages.length > 0 &&
      !contact &&
      !task &&
      !vote;

    const attachmentsReady = this.isAttachmentsReady(attachments || []);

    if (conversationType === 'pin' && pinMessageJumpTo) {
      const jumpButton = (
        <div
          onClick={() =>
            pinMessageJumpTo(
              pinMessageSource || '',
              pinMessageSourceDevice || 1,
              pinMessageTimestamp || 0
            )
          }
          role="button"
          className={classNames(
            'module-message__buttons__jump',
            `module-message__buttons__jump--${direction}`
          )}
        />
      );
      const downloadButton =
        !multipleAttachments && firstAttachment && attachmentsReady ? (
          <Tooltip
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
            placement="top"
            title={i18n('downloadTooltip')}
          >
            <div
              onClick={() => {
                if (onDownload) {
                  onDownload(isDangerous);
                }
              }}
              role="button"
              className={classNames(
                'module-message__buttons__download',
                `module-message__buttons__download--${direction}`
              )}
            />
          </Tooltip>
        ) : null;

      if (direction === 'outgoing') {
        return (
          <div
            className={classNames(
              'module-message__buttons',
              `module-message__buttons--${direction}`
            )}
          >
            {downloadButton}
          </div>
        );
      }

      return (
        <div
          className={classNames(
            'module-message__buttons',
            `module-message__buttons--${direction}`
          )}
        >
          {downloadButton}
          {jumpButton}
        </div>
      );
    }

    const downloadButton =
      !multipleAttachments && firstAttachment && attachmentsReady ? (
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="top"
          title={i18n('downloadTooltip')}
        >
          <div
            onClick={async () => {
              // disable RiskCheckDialog

              if (onDownload) {
                onDownload(isDangerous);
              }

              // if (sha256 && size) {
              //   const result = await getFileCheckResult(sha256, size);
              //   if (result.status === 1) {
              //     if (onDownload) {
              //       onDownload(isDangerous);
              //     }
              //   } else {
              //     this.setState({
              //       onDownload: () => {
              //         if (onDownload) {
              //           onDownload(isDangerous);
              //         }
              //       },
              //       showRiskCheckDialog: true,
              //       checkFileResult: result,
              //     });
              //   }
              // }
            }}
            role="button"
            className={classNames(
              'module-message__buttons__download',
              `module-message__buttons__download--${direction}`
            )}
          />
        </Tooltip>
      ) : null;

    const forwardButton = (
      <>
        {!isConfidentialMessage &&
        status != 'error' &&
        status != 'sending' &&
        !isAudio(attachments) &&
        attachmentsReady &&
        conversationType !== 'forward' &&
        !task &&
        !vote ? (
          <Tooltip
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
            placement="top"
            title={i18n('forwardTooltip')}
          >
            <div
              onClick={this.onForwardMessage}
              role="button"
              className={classNames(
                'module-message__buttons__forward',
                `module-message__buttons__forward--${direction}`
              )}
              style={{
                transform: direction === 'outgoing' ? 'scale(-1,1)' : '',
              }}
            />
          </Tooltip>
        ) : null}
      </>
    );

    const replyButton = (
      <>
        {conversationType === 'group' &&
        showThreadBar &&
        !isConfidentialMessage ? (
          // <Tooltip
          //   mouseEnterDelay={1.5}
          //   overlayClassName={'antd-tooltip-cover'}
          //   placement="top"
          //   title={i18n('replyButton')}
          // >
          //   <div
          //     onClick={
          //       threadProps?.topicId
          //         ? onThreadReply
          //         : onReplyOldMessageWithoutTopic
          //     }
          //     role="button"
          //     className={classNames(
          //       'module-message__buttons__reply',
          //       `module-message__buttons__reply--${direction}`
          //     )}
          //     style={{
          //       transform: direction === 'incoming' ? 'scale(-1,1)' : '',
          //     }}
          //   />
          // </Tooltip>
          <Tooltip
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
            placement="top"
            title={i18n('quoteTooltip')}
          >
            <div
              onClick={onReply}
              role="button"
              className={classNames(
                'module-message__buttons__quote',
                `module-message__buttons__quote--${direction}`
              )}
            />
          </Tooltip>
        ) : !isConfidentialMessage &&
          (conversationType === 'direct' || !showThreadBar) ? (
          <Tooltip
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
            placement="top"
            title={i18n('quoteTooltip')}
          >
            <div
              onClick={onReply}
              role="button"
              className={classNames(
                'module-message__buttons__quote',
                `module-message__buttons__quote--${direction}`
              )}
            />
          </Tooltip>
        ) : null}
      </>
    );

    const menuButton = (
      <>
        {conversationType === 'forward' ? null : (
          <ContextMenuTrigger
            id={triggerId}
            ref={this.captureMenuTriggerBound}
            attributes={{ style: { display: 'flex' } }}
          >
            <Tooltip
              mouseEnterDelay={1.5}
              overlayClassName={'antd-tooltip-cover'}
              placement="top"
              title={i18n('moreTooltip')}
            >
              <div
                role="button"
                onClick={this.showMenuBound}
                className={classNames(
                  'module-message__buttons__menu',
                  `module-message__buttons__menu--${direction}`
                )}
              />
            </Tooltip>
          </ContextMenuTrigger>
        )}
      </>
    );

    const recallButton = null;
    // const recallButton = (
    //   <>
    //     {showRecallMenuItem ? (
    //       <Tooltip mouseEnterDelay={1.5} overlayClassName={'antd-tooltip-cover'} placement="top" title={i18n('recallTooltip')}>
    //         <div
    //           onClick={onRecall}
    //           role="button"
    //           className={classNames(
    //             'module-message__buttons__recall',
    //             `module-message__buttons__recall--${direction}`
    //           )}
    //         />
    //       </Tooltip>
    //     ) : null}
    //   </>
    // );

    const translateButton = (
      <>
        {!isConfidentialMessage && showTranslateMenuItem ? (
          <ContextMenuTrigger
            id={triggerId + '-translate'}
            ref={this.captureTranslateMenuTriggerBound}
            attributes={{ style: { display: 'flex' } }}
          >
            <Tooltip
              mouseEnterDelay={1.5}
              overlayClassName={'antd-tooltip-cover'}
              placement="top"
              title={i18n('translateTooltip')}
            >
              <div
                onClick={this.showTranslateMenuBound}
                role="button"
                className={classNames(
                  'module-message__buttons__translate',
                  `module-message__buttons__translate--${direction}`
                )}
              />
            </Tooltip>
          </ContextMenuTrigger>
        ) : null}
      </>
    );

    const showReaction =
      status !== 'error' &&
      status !== 'sending' &&
      !isAudio(attachments) &&
      (!firstAttachment ||
        (!multipleAttachments && this.isAttachmentsReady(attachments))) &&
      !task &&
      !vote &&
      !contact &&
      conversationType !== 'forward' &&
      !(forwardedMessages && forwardedMessages.length > 1) &&
      emojiReactions?.length;

    const reactionButton = (
      <>
        {!isConfidentialMessage && showReaction ? (
          <Popover
            trigger="click"
            open={this.state.reactionButtonPopoverVisible}
            placement={'top'}
            getPopupContainer={() => this.messageBodyDivRef.current}
            destroyTooltipOnHide={true}
            onOpenChange={(newVisible: boolean) => {
              this.setState({ reactionButtonPopoverVisible: newVisible });
            }}
            content={
              <div className={'emoji-div'}>
                <div className={'emoji-div-mask-right'}></div>
                {emojiReactions.map(emojiReaction => {
                  return this.renderMenuReactionButton(emojiReaction, () => {
                    this.setState({ reactionButtonPopoverVisible: false });
                  });
                })}
                {/* margin with no future */}
                <div style={{ minWidth: '10px' }}></div>
              </div>
            }
            overlayClassName={'model-message__reaction-menu-button-popover'}
          >
            <div
              role="button"
              className={classNames(
                'module-message__buttons__reaction',
                `module-message__buttons__reaction--${direction}`
              )}
            />
          </Popover>
        ) : null}
      </>
    );

    const first = direction === 'incoming' ? downloadButton : menuButton;
    const last = direction === 'incoming' ? menuButton : downloadButton;

    return (
      <div
        className={classNames(
          'module-message__buttons',
          `module-message__buttons--${direction}`
        )}
      >
        {first}
        {direction === 'incoming' ? null : translateButton}
        {direction === 'incoming' ? null : forwardButton}
        {direction === 'incoming' ? null : reactionButton}
        {replyButton}
        {direction === 'incoming' ? reactionButton : null}
        {direction === 'incoming' ? forwardButton : null}
        {direction === 'incoming' ? null : recallButton}
        {direction === 'incoming' ? translateButton : null}
        {last}
      </div>
    );
  }

  public renderSelectMenuItem = () => {
    const { i18n, onChangeMultiSelectingMode } = this.props;

    return (
      <MenuItem
        key={uuidv4()}
        attributes={{ className: 'module-message__context__mutli_select' }}
        onClick={() => {
          if (onChangeMultiSelectingMode) {
            onChangeMultiSelectingMode(true);
          }
        }}
      >
        {i18n('selectMessages')}
      </MenuItem>
    );
  };

  public renderTranslateMenuItem = (skipOff?: boolean) => {
    const { supportedLanguages, onChangeTranslation } = this.props;

    if (!supportedLanguages) {
      return null;
    }

    let shouldSkip = skipOff;

    const menuItems: any[] = [];
    for (let item of supportedLanguages) {
      if (shouldSkip) {
        shouldSkip = false;
        continue;
      }

      menuItems.push(
        <MenuItem
          key={uuidv4()}
          attributes={{
            className: `module-message__context__translate-${item.lang}`,
          }}
          onClick={() => {
            if (onChangeTranslation) {
              onChangeTranslation(item.lang);
            }
          }}
        >
          {item.name}
        </MenuItem>
      );
    }

    return menuItems;
  };

  public renderMessageContextMenu(triggerId: string) {
    const {
      attachments,
      direction,
      status,
      onDelete,
      onDownload,
      onReply,
      onRetrySend,
      onShowDetail,
      i18n,
      conversationType,
      forwardedMessages,
      onRecall,
      isRecalled,
      recallable,
      recallableExpiredAt,
      text,
      onChangeTranslation,
      supportedLanguages,
      onCopyImage,
      task,
      vote,
      contact,
      //onPin,
      //pinId,
      isConfidentialMessage,
      emojiReactions,
      // showThreadBar,
    } = this.props;

    const menuItems = [];

    const multipleAttachments = attachments && attachments.length > 1;
    const firstAttachment = attachments && attachments[0];
    const isSingleAttachment = !multipleAttachments && !!firstAttachment;

    if (isSingleAttachment && this.isAttachmentsReady(attachments)) {
      const isDangerous = isFileDangerous(firstAttachment.fileName || '');

      menuItems.push(
        <MenuItem
          key={uuidv4()}
          attributes={{ className: 'module-message__context__download' }}
          onClick={() => {
            if (onDownload) {
              onDownload(isDangerous);
            }
          }}
        >
          {i18n('downloadAttachment')}
        </MenuItem>
      );

      // copy image
      const { imageBroken } = this.state;
      const displayImage = canDisplayImage(attachments);

      if (
        displayImage &&
        !imageBroken &&
        isImage(attachments) &&
        hasImage(attachments) &&
        onCopyImage &&
        !isConfidentialMessage
      ) {
        menuItems.push(
          <MenuItem
            key={uuidv4()}
            attributes={{ className: 'module-message__context__copy-image' }}
            onClick={() => {
              onCopyImage(firstAttachment);
            }}
          >
            {i18n('copyImage')}
          </MenuItem>
        );
      }
    }

    const isForwardConversation = conversationType === 'forward';
    const hasMultiForwards = forwardedMessages && forwardedMessages.length > 1;
    const showReply = !isForwardConversation && !hasMultiForwards;

    if (showReply) {
      menuItems.push(
        <MenuItem
          key={uuidv4()}
          attributes={{ className: 'module-message__context__reply' }}
          onClick={onReply}
        >
          {i18n('replyToMessage')}
        </MenuItem>
      );
    }

    const attachmentsReady = this.isAttachmentsReady(attachments || []);
    // status for messag alreay post to server.
    const alreayPost = status !== 'error' && status !== 'sending';
    //alert(isConfidentialMessage);
    const showForward =
      !isForwardConversation &&
      alreayPost &&
      !isAudio(attachments) &&
      !isConfidentialMessage &&
      attachmentsReady;

    if (showForward) {
      menuItems.push(
        <MenuItem
          key={uuidv4()}
          attributes={{ className: 'module-message__context__forward' }}
          onClick={this.onForwardMessage}
        >
          {i18n('forwardMessage')}
        </MenuItem>,
        <MenuItem
          key={uuidv4()}
          attributes={{ className: 'module-message__context__forward_me' }}
          onClick={this.onForwardMessageToMe}
        >
          {i18n('forwardMessageToMe')}
        </MenuItem>
      );
      menuItems.push(this.renderSelectMenuItem());
    }

    const showRecall =
      alreayPost &&
      recallable &&
      !this.state.recallableExpired &&
      direction === 'outgoing' &&
      recallableExpiredAt;

    if (showRecall) {
      menuItems.push(
        <MenuItem
          key={uuidv4()}
          attributes={{ className: 'module-message__context__recall' }}
          onClick={onRecall}
        >
          {i18n('recallTitle')}
        </MenuItem>
      );
    }

    const showTranslate =
      text &&
      text.length > 0 &&
      onChangeTranslation &&
      supportedLanguages &&
      supportedLanguages.length > 0;

    if (showTranslate) {
      const { translateLang, translateOff } = this.props;
      const showOff = Boolean(translateOff && translateLang === translateOff);

      menuItems.push(
        <div
          className="module-message__context__translate"
          key={'context-translate'}
        >
          <SubMenu
            key={uuidv4()}
            className="module-message__context__translate"
            title={<>{i18n('translateTitle')}</>}
          >
            {this.renderTranslateMenuItem(showOff)}
          </SubMenu>
        </div>
      );
    }

    // const showQuote = conversationType === 'group';
    // if (
    //   !(
    //     conversationType === 'forward' ||
    //     (forwardedMessages && forwardedMessages.length > 1)
    //   ) &&
    //   conversationType !== 'direct' &&
    //   !isConfidentialMessage &&
    //   showThreadBar
    // ) {
    //   menuItems.push(
    //     <MenuItem key={uuidv4()} onClick={onReply}>
    //       {/*{'Reply'}*/}
    //       {i18n('quoteTooltip')}
    //     </MenuItem>
    //   );
    // }

    // const showPin =
    //   alreayPost &&
    //   !isAudio(attachments) &&
    //   (!isSingleAttachment ||
    //     (isSingleAttachment && this.isAttachmentsReady(attachments))) &&
    //   !task &&
    //   !vote &&
    //   !contact &&
    //   conversationType === 'group';
    // if (showPin || pinId) {
    // menuItems.push(
    //   <MenuItem
    //     key={uuidv4()}
    //     onClick={() => {
    //       onPin && onPin(!pinId);
    //     }}
    //   >
    //     {pinId ? i18n('unpin') : 'Pin'}
    //   </MenuItem>
    // );
    // }

    // const showAddTask = !!text;
    // if (showAddTask) {
    //   menuItems.push(
    //     <MenuItem
    //       key={uuidv4()}
    //       attributes={{ className: 'module-message__context__add-task' }}
    //       onClick={this.onNewTask}
    //     >
    //       {i18n('addTask')}
    //     </MenuItem>
    //   );
    // }

    menuItems.push(
      <MenuItem
        key={uuidv4()}
        attributes={{ className: 'module-message__context__more-info' }}
        onClick={onShowDetail}
      >
        {i18n('moreInfo')}
      </MenuItem>
    );

    const showRetry = status === 'error' && direction === 'outgoing';
    if (showRetry) {
      menuItems.push(
        <MenuItem
          key={uuidv4()}
          attributes={{ className: 'module-message__context__retry-send' }}
          onClick={onRetrySend}
        >
          {isRecalled ? i18n('retryRecall') : i18n('retrySend')}
        </MenuItem>
      );
    }

    // hide delete menu item.
    const isShowDelete = status === 'error' && direction === 'outgoing';
    if (isShowDelete) {
      menuItems.push(
        <MenuItem
          key={uuidv4()}
          attributes={{ className: 'module-message__context__delete-message' }}
          onClick={onDelete}
        >
          {i18n('deleteMessage')}
        </MenuItem>
      );
    }

    const showReaction =
      alreayPost &&
      !isAudio(attachments) &&
      (!isSingleAttachment ||
        (isSingleAttachment && this.isAttachmentsReady(attachments))) &&
      !task &&
      !vote &&
      !contact &&
      !isForwardConversation &&
      !hasMultiForwards &&
      emojiReactions?.length;

    if (showReaction) {
      menuItems.push(
        <Popover
          key={uuidv4()}
          trigger="click"
          open={this.state.reactionMenuPopoverVisible}
          placement={'left'}
          destroyTooltipOnHide={true}
          getPopupContainer={() => this.messageBodyDivRef.current}
          onOpenChange={(newVisible: boolean) => {
            this.setState({ reactionMenuPopoverVisible: newVisible });
          }}
          content={emojiReactions.map(emojiReaction => {
            return this.renderMenuReactionButton(emojiReaction, () => {
              this.setState({ reactionMenuPopoverVisible: false });
            });
          })}
          overlayClassName={'model-message__reaction-menu-button-popover'}
        >
          <MenuItem
            key={uuidv4()}
            attributes={{ className: 'module-message__context__reaction' }}
          >
            {'Add Reaction'}
          </MenuItem>
        </Popover>
      );
    }

    if (menuItems.length > 0) {
      return (
        <ContextMenu key={uuidv4()} id={triggerId}>
          {menuItems}
        </ContextMenu>
      );
    }

    return null;
  }

  public renderContextMenu(triggerId: string) {
    if (!this.state.isVisible) {
      return null;
    }

    const { text, onChangeTranslation, supportedLanguages, conversationType } =
      this.props;

    const contextMenus = [];

    const isForwardConversation = conversationType === 'forward';
    const isPinConversation = conversationType === 'pin';
    if (!isForwardConversation && !isPinConversation) {
      contextMenus.push(
        <ContextMenu key={uuidv4()} id={triggerId + '-hidden'}>
          {this.renderSelectMenuItem()}
        </ContextMenu>
      );
    }

    contextMenus.push(this.renderMessageContextMenu(triggerId));

    const showTranslate =
      text &&
      text.length > 0 &&
      onChangeTranslation &&
      supportedLanguages &&
      supportedLanguages.length > 0;

    if (showTranslate) {
      contextMenus.push(
        <ContextMenu key={uuidv4()} id={triggerId + '-translate'}>
          {this.renderTranslateMenuItem(true)}
        </ContextMenu>
      );
    }

    return contextMenus;
  }

  public renderForwardHeader() {
    const { i18n, direction, isSingleForward, forwardedMessages } = this.props;

    if (!isSingleForward) {
      return null;
    }

    if (!forwardedMessages || forwardedMessages.length !== 1) {
      return null;
    }

    const { authorName, timestamp } = forwardedMessages[0];

    const formatedSentAt = moment(timestamp).format('DD/MM/YYYY HH:mm');

    return (
      <>
        <div
          className={classNames(`module-message__forward-header--${direction}`)}
        >
          <span>{i18n('forwardHeader') + ' '}</span>
          <span
            className={classNames(
              'module-message__forward-header-origin-time',
              `module-message__forward-header-origin-time--${direction}`
            )}
          >
            {formatedSentAt}
          </span>
        </div>
        <div
          className={classNames(`module-message__forward-from--${direction}`)}
        >
          {i18n('forwardFrom', [authorName])}
        </div>
      </>
    );
  }

  public closeForwardDialog = () => {
    this.setState({ showForwardDialog: false });
  };

  public onCheckboxClicked = (e: any) => {
    const { onSelectChange } = this.props;

    if (onSelectChange && e.target.type === 'checkbox') {
      onSelectChange(e.target.checked, e.shiftKey);
    }
  };

  public onCheckedChange = (_e: any) => {
    // const { id, authorId } = this.props;
    // (window as any).console.log(`${authorId} ${id} checked changed to ${e?.target?.checked}`);
  };

  public renderTranslateContent(_triggerId: string) {
    const {
      i18n,
      direction,
      translatedText,
      translateLang,
      translating,
      onMouseOverMessage,
      isConfidentialMessage,
      translateError,
    } = this.props;

    if (isConfidentialMessage) {
      return null;
    }

    const displayTranslate = translatedText && translateLang;
    if (!displayTranslate && !translating && !translateError) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-message',
          `module-message--${direction}`,
          'module-message__translate',
          this.state.expiring ? 'module-message--expired' : null
        )}
      >
        <div
          onMouseOut={() => {
            this.setState({ isMouseOver: false });
          }}
          onMouseOver={() => {
            this.setState({ isMouseOver: true });
            if (onMouseOverMessage && isConfidentialMessage) {
              onMouseOverMessage();
            }
          }}
          className={classNames(
            'module-message__container',
            `module-message__container__translate--${direction}`
          )}
        >
          {this.renderTranslateText()}
          <div
            className={classNames(
              'module-message__metadata',
              'module-message__metadata__translated_by',
              `module-message__metadata__translated_by--${direction}`
            )}
          >
            <div
              className={classNames(
                'module-message__metadata__translated_by--icon',
                `module-message__metadata__translated_by--icon--${direction}`
              )}
            ></div>
            {i18n('translatedBy')}
          </div>
        </div>
      </div>
    );
  }

  public renderThread() {
    const {
      direction,
      showThreadBar,
      threadId,
      threadReplied,
      onShowThread,
      threadProps,
      isSelectingMode,
      conversationType,
    } = this.props;

    if (
      !showThreadBar ||
      !onShowThread ||
      !threadId ||
      !threadProps ||
      !threadReplied ||
      conversationType === 'direct'
    ) {
      return null;
    }

    const backgroundColors = [
      'rgb(255,69,58)',
      'rgb(255,159,11)',
      'rgb(254,215,9)',
      'rgb(49,209,91)',
      'rgb(120,195,255)',
      'rgb(11,132,255)',
      'rgb(94,92,230)',
      'rgb(213,127,245)',
      'rgb(114,126,135)',
      'rgb(255,79,121)',
    ];

    const calcColor = (radix: number) => {
      const sub = threadId.substr(threadId.length - 2, 2);
      const index = parseInt(sub, radix) % 10;
      return backgroundColors[index];
    };

    return (
      <div
        className={classNames(
          `module-message__thread__header-bar--${direction}`,
          isSelectingMode
            ? 'module-message__thread__header-bar-selecting'
            : null
        )}
        style={{ backgroundColor: calcColor(16) }}
        onClick={() => {
          onShowThread();
        }}
      ></div>
    );
  }

  public renderMessageContent(triggerId: string) {
    const {
      authorColor,
      direction,
      attachments,
      contact,
      task,
      vote,
      card,
      onMouseOverMessage,
      isConfidentialMessage,
      forwardedMessages,
    } = this.props;

    const { imageBroken, expiring } = this.state;

    const hasValidAttachment =
      (isImage(attachments) && hasImage(attachments)) ||
      (isVideo(attachments) && hasVideoScreenshot(attachments));

    const showImage =
      canDisplayImage(attachments) && !imageBroken && hasValidAttachment;

    const cardType = card?.contentType;
    const isCardMessage =
      task ||
      vote ||
      contact ||
      (forwardedMessages && forwardedMessages.length > 1) ||
      (card && !cardType);
    const cellStyle: any = {};
    if (isCardMessage) {
      cellStyle.padding = direction === 'incoming' ? '10px 0' : '0';
      cellStyle.backgroundColor = 'transparent';
    }

    return (
      <div
        ref={this.messageBodyDivRef}
        className={classNames(
          'module-message',
          `module-message--${direction}`,
          expiring ? 'module-message--expired' : null
        )}
        style={{ width: showImage ? getGridDimensions()?.width : undefined }}
      >
        {this.renderMenu(direction === 'outgoing', triggerId)}
        {this.renderError(direction === 'outgoing')}
        <div
          onMouseOut={() => {
            this.setState({ isMouseOver: false });
          }}
          onMouseOver={() => {
            this.setState({ isMouseOver: true });
            if (onMouseOverMessage && isConfidentialMessage) {
              onMouseOverMessage();
            }
          }}
          className={classNames(
            'module-message__container',
            `module-message__container--${direction}`,
            hasValidAttachment
              ? 'module-message__container__media_with_text'
              : null,
            direction === 'incoming'
              ? `module-message__container--incoming-${authorColor}`
              : null
          )}
          style={cellStyle}
        >
          {this.renderPinIcon()}
          {this.renderAuthor()}
          {/*{this.renderReplyHeader()}*/}
          {this.renderForwardHeader()}
          {this.renderQuote()}
          {this.renderAttachment()}
          {this.renderEmbeddedContact()}
          {this.renderTask()}
          {this.renderPoll()}
          {this.renderCard()}
          {this.renderText()}
          {this.renderForwardedMessage()}
          {this.renderMessageReactions()}
          {this.renderBottomBar()}
          {this.renderSendMessageButton()}
          {this.renderAvatar()}
        </div>
        {this.renderMenu(direction === 'incoming', triggerId)}
        {this.renderError(direction === 'incoming')}
        {this.renderContextMenu(triggerId)}
      </div>
    );
  }

  public renderForwardDialog() {
    const { showForwardDialog, conversations } = this.state;
    if (!showForwardDialog) {
      return null;
    }

    const { i18n, onForwardTo } = this.props;

    return (
      <ForwardDialog
        i18n={i18n}
        onForwardTo={onForwardTo}
        conversations={conversations}
        onClose={this.closeForwardDialog}
        onCancel={this.closeForwardDialog}
      />
    );
  }

  public renderNewTaskDialog() {
    const { showNewTaskDialog } = this.state;
    if (!showNewTaskDialog) {
      return null;
    }

    const { i18n, text, task, atPersons, ourNumber, conversationId } =
      this.props;

    return (
      <TaskDialog
        i18n={i18n}
        task={task}
        atPersons={atPersons}
        ourNumber={ourNumber}
        conversationId={conversationId}
        name={text}
        onCancel={this.closeNewTaskDialog}
      />
    );
  }

  public render() {
    const {
      isSelected,
      isSelectingMode,
      isConfidentialMessage,
      isSelectDisabled,
      conversationType,
      status,
      isRecalled,
    } = this.props;

    const { expired, randomTriggerId, showRiskCheckDialog } = this.state;

    // This id is what connects our triple-dot click with our associated pop-up menu.
    //   It needs to be unique.
    const triggerId = 'message-trigger-id-' + randomTriggerId;

    if (
      expired ||
      (isRecalled &&
        (status === 'sent' || status === 'delivered' || status === 'read'))
    ) {
      return null;
    }

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        {isSelectingMode && !isConfidentialMessage ? (
          <div
            className="message-select-checkbox-wrapper"
            onClick={this.onCheckboxClicked}
          >
            <label className="message-select-checkbox-label">
              <input
                className={classNames('message-select-checkbox')}
                type="checkbox"
                onChange={this.onCheckedChange}
                checked={isSelected && !isSelectDisabled ? true : false}
                disabled={isSelectDisabled}
              />
            </label>
          </div>
        ) : null}
        <div
          className={classNames(
            isSelectingMode ? 'message-select-wrapper' : 'message-wrapper'
          )}
        >
          {conversationType === 'forward' ? null : (
            <ContextMenuTrigger id={triggerId + '-hidden'} holdToDisplay={-1}>
              <div
                className={classNames('module-message__hidden__right_menu_div')}
              />
            </ContextMenuTrigger>
          )}
          <div className="module-message__content-wrapper">
            {this.renderThread()}
            {this.renderMessageContent(triggerId)}
            {this.renderTranslateContent(triggerId)}
          </div>
        </div>

        {this.renderForwardDialog()}
        {this.renderNewTaskDialog()}
        {showRiskCheckDialog ? this.renderRiskCheckDialog() : null}
      </div>
    );
  }
}
