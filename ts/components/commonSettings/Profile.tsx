import React from 'react';
import { trigger } from '../../shims/events';
import { LocalizerType } from '../../types/Util';
import { Avatar } from '.././Avatar';
import ProfileItem from './ProfileItem';
import ProfileEditSignature from './ProfileEditSignature';
import { Tooltip } from 'antd';
import ProfileModal from './ProfileModal';
import { isEqual } from 'lodash';
import { processImageFile } from '../../util/processImageFile';
import { getConversationProps } from '../../shims/Whisper';
import { StateType } from '../../state/reducer';

export interface Props {
  i18n: LocalizerType;
  onClose: () => void;
  id: any;
  shareid?: string;
  x: number;
  y: number;
  avatarPath?: string;
  isLeaderCard?: boolean;
  dialogShownAt?: number;
  allowUpload?: boolean;
  isMarkDownCard?: boolean;
}

interface State {
  userStatus?: number;
  noActiveSeconds?: number;
  userInfo: any;
  showCopyName: boolean;
  editSignMode: boolean;
  editNameMode: boolean;
  newSignature: string;
  newName: string;
  tips: string;
  isBot: boolean;
  isTestImage: boolean;
  testImageData: string;
  showEditNameButton: boolean;
  showEditSignatureButton: boolean;
  goBin: string;
  showLeaderProfile?: boolean;
  dialogShownAt?: number;
  likeCount: number;
  likeDetail: Array<string>;
}

interface ProfileItemProps {
  field: string;
  title: string;
  isShowCopy?: boolean;
  isRole?: boolean;
  isShowTip?: boolean;
  onClick?: (event: any) => void;
  isShowArrowimg?: boolean;
  onClickArrowimg?: (event: any) => void;
}

// const nameLengthMax = 30;
const signLengthMax = 80;

export class Profile extends React.Component<Props, State> {
  public noActiveTimer: number;
  public dismissTipsTimer: number;
  public inputRefImageSelect: React.RefObject<HTMLInputElement>;
  public profileRef: React.RefObject<HTMLDivElement>;

  private hasListenUserStatusChange: boolean;

  isBotId(id: string) {
    return id?.length <= 6;
  }

  constructor(props: Readonly<Props>) {
    super(props);
    this.profileRef = React.createRef();

    const isBot = this.isBotId(props.id);

    this.state = {
      userStatus: isBot ? 0 : -1,
      noActiveSeconds: -1,
      userInfo: undefined,
      showCopyName: false,
      editSignMode: false,
      editNameMode: false,
      newSignature: '',
      newName: '',
      tips: '',
      isBot,
      isTestImage: false,
      testImageData: '',
      showEditNameButton: false,
      showEditSignatureButton: false,
      goBin: 'Go',
      likeCount: 0,
      likeDetail: [],
    };

    this.inputRefImageSelect = React.createRef();
    this.noActiveTimer = 0;
    this.dismissTipsTimer = 0;
    this.hasListenUserStatusChange = false;
  }

  updateUserStatusListener(id: string) {
    if (!id) {
      return;
    }

    if (this.isBotId(id)) {
      if (this.hasListenUserStatusChange) {
        window.removeEventListener(
          'event-user-status-changed',
          this.userStatusChanged
        );
      }
      this.setState({ userStatus: -1 });
      return;
    }

    const userStatusReceiver = (window as any).userStatusReceiver;
    if (!userStatusReceiver) {
      return;
    }

    if (!this.hasListenUserStatusChange) {
      window.addEventListener(
        'event-user-status-changed',
        this.userStatusChanged
      );
      this.hasListenUserStatusChange = true;
    }

    const updateEvent = userStatusReceiver.addUserListen(id);
    if (updateEvent) {
      setImmediate(() => {
        this.userStatusChanged(updateEvent);
      });
    } else {
      this.setState({ userStatus: -1 });
    }
  }

  updateUserInfoState(id: string) {
    if (!id) {
      return;
    }

    const conversation = (window as any).ConversationController.get(id);
    if (!conversation) {
      return;
    }

    let newSignature = conversation.get('signature');
    if (newSignature && newSignature.length > signLengthMax) {
      newSignature = newSignature.substr(0, signLengthMax);
    }

    let newName = conversation.getName();
    if (!newName) {
      newName = conversation.getTitle() || conversation.getNumber();
    }

    const likeCount = conversation.attributes.thumbsUp?.thumbsUpCount;
    const newState = {
      newSignature,
      newName,
      isBot: this.isBotId(id),
      likeCount,
    };

    if (!isEqual(conversation.format(), this.state.userInfo)) {
      this.setState({
        ...newState,
        userInfo: conversation.format(),
      });
    } else {
      this.setState(newState);
    }
  }

  async componentDidMount() {
    const { id } = this.props;

    window.addEventListener('resize', this.resize);
    window.addEventListener('event-close-user-profile', this.closeSelf);
    this.updateUserInfoState(id);
    this.updateUserStatusListener(id);
    this.getOrUpdateLikeInfo();
  }

  shouldComponentUpdate(nextProps: Readonly<Props>): boolean {
    if (this.props.dialogShownAt !== nextProps.dialogShownAt) {
      const { id } = this.props;
      this.updateUserInfoState(id);
      this.updateUserStatusListener(id);
      this.getOrUpdateLikeInfo(id);
      return false;
    }
    return true;
  }

  public componentWillUnmount = () => {
    window.removeEventListener('event-close-user-profile', this.closeSelf);
    window.removeEventListener('resize', this.resize);

    if (this.hasListenUserStatusChange) {
      window.removeEventListener(
        'event-user-status-changed',
        this.userStatusChanged
      );
    }

    if (
      this.props.id &&
      (window as any).userStatusReceiver &&
      !this.state.isBot
    ) {
      (window as any).userStatusReceiver.removeUserListen(this.props.id);
    }

    if (this.noActiveTimer) {
      clearInterval(this.noActiveTimer);
    }

    if (this.dismissTipsTimer) {
      clearTimeout(this.dismissTipsTimer);
    }
  };

  public userStatusChanged = (event: any) => {
    const { userInfo } = this.state;
    if (userInfo?.id && event?.detail?.user === userInfo.id) {
      this.setState({
        userStatus: event.detail.status,
        noActiveSeconds: event.detail.ts,
      });

      if (event.detail.status === 2 && event.detail.ts) {
        if (this.noActiveTimer) {
          clearInterval(this.noActiveTimer);
        }

        this.noActiveTimer = window.setInterval(() => {
          this.setState(prevState => ({
            // @ts-ignore
            noActiveSeconds: prevState.noActiveSeconds + 1,
          }));
        }, 1000);
      }
    }
  };

  public closeSelf = () => {
    this.props?.onClose();
  };
  public resize = () => {
    const { showLeaderProfile } = this.state;
    if (showLeaderProfile) {
      this.setState({
        showLeaderProfile: true,
      });
    }
  };
  public formatSecond(sec: number | undefined) {
    const { i18n } = this.props;

    if (!sec) {
      return '';
    }

    if (sec < 60 * 60) {
      return i18n('active_minutes_ago', [`${Math.floor(sec / 60)}`]);
    }

    if (sec < 60 * 60 * 24) {
      return i18n('active_hours_ago', [`${Math.floor(sec / 60 / 60)}`]);
    }

    if (sec < 60 * 60 * 24 * 7) {
      return i18n('active_days_ago', [`${Math.floor(sec / 60 / 60 / 24)}`]);
    }

    if (sec < 60 * 60 * 24 * 30) {
      return i18n('active_weeks_ago', [
        `${Math.floor(sec / 60 / 60 / 24 / 7)}`,
      ]);
    }

    return i18n('active_months_ago');
  }

  public mouseOverName = () => {
    // const { userInfo } = this.state;
    // const isMe = userInfo?.isMe;
    // if (isMe) {
    //   this.setState({ showEditNameButton: true });
    //   return;
    // }
    this.setState({ showCopyName: true });
  };

  public mouseLeaveName = () => {
    // const { userInfo } = this.state;
    // const isMe = userInfo?.isMe;
    // if (isMe) {
    //   this.setState({ showEditNameButton: false });
    //   return;
    // }
    this.setState({ showCopyName: false });
  };

  public mouseOverSign = () => {
    // const { userInfo } = this.state;
    // const isMe = userInfo?.isMe;
    // if (isMe) {
    //   this.setState({ showEditSignatureButton: true });
    // }
  };

  public mouseLeaveSign = () => {
    // const { userInfo } = this.state;
    // const isMe = userInfo?.isMe;
    // if (isMe) {
    //   this.setState({ showEditSignatureButton: false });
    // }
  };

  public shareContact = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ev = new Event('close-task-dialog');
    window.dispatchEvent(ev);

    const { userInfo } = this.state;
    const number = userInfo?.id;
    const name = this.state.newName;
    if (number) {
      const myEvent = new CustomEvent('event-share-user-contact', {
        detail: { number, name },
      });
      window.dispatchEvent(myEvent);
      this.props?.onClose();
    }
  };
  public getOrUpdateLikeInfo = async (leaderId?: undefined) => {
    const { id, i18n } = this.props;
    const { userInfo } = this.state;
    const conversation = await (
      window as any
    ).ConversationController.getOrCreateAndWait(
      leaderId ? leaderId : userInfo ? userInfo?.id : id,
      'private'
    );
    if (userInfo) {
      await conversation.throttledForceUpdatePrivateContact();
    } else {
      await conversation.forceUpdatePrivateContact();
    }

    let latestLikePeople = conversation?.attributes?.thumbsUp?.lastSource;

    if (!latestLikePeople) {
      if (this.state.userInfo) {
        this.setState({
          likeCount: 0,
          userInfo: {
            ...conversation.format(),
          },
          newSignature: conversation.get('signature'),
          newName: conversation.getName(),
        });
      }
      return;
    }

    let likeCount = conversation?.attributes?.thumbsUp?.thumbsUpCount;
    let content: Array<string> = [];
    for (let i = 0; i < latestLikePeople.length; i++) {
      let newConversation = await (
        window as any
      ).ConversationController.getOrCreateAndWait(
        latestLikePeople[i].number,
        'private'
      );

      if (newConversation.getName()) {
        content.push(newConversation.getName());
      } else {
        content.push(latestLikePeople[i].publicName);
      }

      if (i === latestLikePeople.length - 1 && likeCount > 3) {
        // @ts-ignore
        content.push(
          i18n('and') + (likeCount - latestLikePeople.length) + i18n('more')
        );
      }
    }

    this.setState({
      likeCount: likeCount,
      likeDetail: content,
    });
  };

  public like = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { i18n } = this.props;
    try {
      const { userInfo } = this.state;
      await (window as any).getAccountManager().requestThumbsUp(userInfo?.id);
      this.getOrUpdateLikeInfo();
      (window as any).noticeWithoutType(i18n('like_success'));
    } catch (e) {
      (window as any).noticeError(i18n('like_failed'));
    }
  };

  public onClickCommonGroups = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ev = new Event('close-task-dialog');
    window.dispatchEvent(ev);
    const { userInfo } = this.state;
    let conversationFrom = null;
    if (this.props.shareid) {
      conversationFrom = {
        uid: userInfo?.id,
        id: this.props.shareid,
        type: 'shareContact',
        isSend: true,
      };
    }

    trigger(
      'showConversation',
      userInfo?.id,
      null,
      null,
      null,
      conversationFrom,
      true
    );
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);
    this.props?.onClose();
  };
  public openChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ev = new Event('close-task-dialog');
    window.dispatchEvent(ev);
    const { userInfo } = this.state;
    let conversationFrom = null;
    if (this.props.shareid) {
      conversationFrom = {
        uid: userInfo?.id,
        id: this.props.shareid,
        type: 'shareContact',
        isSend: true,
      };
    }

    trigger(
      'showConversation',
      userInfo?.id,
      null,
      null,
      null,
      conversationFrom
    );
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);
    this.props?.onClose();
  };

  public openVoice = (e: React.MouseEvent) => {
    const { i18n } = this.props;
    e.preventDefault();
    e.stopPropagation();

    // if ((window as any).Signal.OS.isLinux()) {
    //   alert((window as any).i18n('meeting-linux-not-support'));
    //   return;
    // }

    const theUser = (window as any).ConversationController.get(this.props?.id);
    if (!theUser || !theUser.isDirectoryUser()) {
      alert(i18n('different_subteam_error'));
      // if (confirm(i18n('different_subteam_error'))) {
      //   trigger('showConversation', '+10000');
      // }
      return;
    }

    const ev = new Event('close-task-dialog');
    window.dispatchEvent(ev);

    const { userInfo } = this.state;
    trigger('showConversation', userInfo?.id);
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);

    let serverToken;
    if ((window as any).textsecure && (window as any).textsecure.messaging) {
      serverToken = (window as any).textsecure.messaging.getServerTokenDirect();
    }
    // call voice
    (window as any).showCallVoiceGroup({
      isPrivate: true,
      avatar: this.state.userInfo?.avatarPath,
      meetingName: this.state.userInfo?.name,
      id: this.props?.id,
      serverToken,
    });
    this.props?.onClose();
  };

  public inputUploadImage = () => {
    if (this.inputRefImageSelect.current) {
      this.inputRefImageSelect.current.click();
    }
  };

  public inputImageSelectChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      if (event.target.files && event.target.files[0]) {
        if (this.state.testImageData) {
          this.showTips('[Upload Avatar] unknown error, try again!');
          return;
        }

        const file = event.target.files[0];
        if (file.size === 0 || file.size > 10 * 1024 * 1024) {
          this.showTips(this.props.i18n('profile_bad_avatar_image_size'));
          return;
        }

        let newAvatar: Uint8Array;
        try {
          newAvatar = await processImageFile(file);
        } catch (err) {
          // Processing errors should be rare; if they do, we silently fail. In an ideal
          //   world, we may want to show a toast instead.
          return;
        }
        if (newAvatar) {
          const b64Avatar =
            'data:image/png;base64,' +
            (window as any).Signal.Crypto.arrayBufferToBase64(newAvatar);
          this.setState({ isTestImage: true, testImageData: b64Avatar });
        }

        // const reader = new FileReader();
        // reader.onload = (e: ProgressEvent<FileReader>) => {
        //   const imageData = e?.target?.result;
        //
        //   // NOT SUPPORT GIF FORMAT
        //   if (typeof imageData === 'string') {
        //     debugger
        //     const pos = imageData.indexOf(';base64,');
        //     if (pos !== -1) {
        //       const dst = imageData.substr(pos + 8);
        //       if (dst.startsWith('R0lGODlh') || dst.startsWith('R0lGODdh')) {
        //         this.showTips(this.props.i18n('profile_load_image_failed'));
        //         return;
        //       }
        //     }
        //   }
        //
        //   if (typeof imageData === 'string') {
        //     this.setState({ isTestImage: true, testImageData: imageData });
        //   }
        // };
        // reader.readAsDataURL(file);
      }
    } catch (e) {
      console.error('[Upload Avatar] exception:', e);
      this.showTips('[Upload Avatar] unknown error, try again!');
    } finally {
      if (this.inputRefImageSelect.current) {
        this.inputRefImageSelect.current.value = '';
      }
    }
  };

  public showTips = (text: string) => {
    if (this.dismissTipsTimer) {
      clearTimeout(this.dismissTipsTimer);
      this.dismissTipsTimer = 0;
    }
    this.setState({ tips: text });
    this.dismissTipsTimer = window.setTimeout(() => {
      this.dismissTipsTimer = 0;
      this.setState({ tips: '' });
    }, 1500);
  };

  public showCopiedTips = () => {
    const { i18n } = this.props;
    this.showTips(i18n('profile_copied'));
  };

  public copyName = async () => {
    const { newName } = this.state;
    if (newName) {
      (window as any).copyText(newName);
      this.showCopiedTips();
    }
  };

  public renderTestImage() {
    if (this.state.isTestImage) {
      return (
        <img
          src={this.state.testImageData}
          onError={() => {
            this.showTips(this.props.i18n('profile_load_image_failed'));
            this.setState({ isTestImage: false, testImageData: '' });
          }}
          onLoad={() => {
            const imageData = this.state.testImageData;
            (window as any).uploadAvatar(imageData);
            this.setState({ isTestImage: false, testImageData: '' });
          }}
          style={{ display: 'none' }}
        />
      );
    }
    return null;
  }

  public renderStatus() {
    const { i18n } = this.props;
    const { userInfo, userStatus } = this.state;

    let text = '';
    if (userInfo?.id) {
      switch (userStatus) {
        case 0:
          text = i18n('active');
          break;
        case 1:
          text = i18n('dont_distrub');
          break;
        case 2:
          text = this.formatSecond(this.state.noActiveSeconds);
          break;
        case 3:
          text = i18n('calling');
          break;
        case 5:
          text = i18n('meeting');
          break;
        default:
          break;
      }
    }

    return (
      <span
        className={'profile-status'}
        style={{
          height: '20px',
          width: '180px',
          fontSize: '11px',
          // fontSize: '12px',
          // color: 'gray',
          display: 'block',
        }}
      >
        {text}
      </span>
    );
  }

  public signatureEditComplete = async (textComplete: string | undefined) => {
    let text = textComplete;
    if (text && text.length > signLengthMax) {
      text = text.substr(0, signLengthMax);
    }
    if (this.state.newSignature === text) {
      this.setState({ editSignMode: false });
      return;
    }

    this.setState({ editSignMode: false, newSignature: text || '' });
    const res = await (window as any).updateSignature(text);
    if (!res) {
      this.props?.onClose();
    }
  };

  public renderSign() {
    // const { i18n } = this.props;
    const { userInfo, newSignature, showEditSignatureButton } = this.state;
    const isMe = userInfo?.isMe;

    if (!newSignature && !isMe) {
      return null;
    }

    if (this.state.editSignMode) {
      return (
        <ProfileEditSignature
          content={newSignature}
          editName={false}
          onComplete={this.signatureEditComplete}
        />
      );
    }

    const displaySign = newSignature || '';

    return (
      <div
        style={{
          position: 'relative',
          // width: '232px',
          maxHeight: '40px',
          // margin: '0 24px 8px 24px',
          padding: '0 24px 8px 24px',
        }}
        onMouseOver={this.mouseOverSign}
        onMouseLeave={this.mouseLeaveSign}
      >
        <span
          className={'profile-signature'}
          style={{
            display: '-webkit-box',
            wordBreak: 'break-word',
            fontWeight: 400,
            alignItems: 'center',
            fontStyle: 'normal',
          }}
        >
          <Tooltip
            title={displaySign}
            align={{ offset: [0, 5] }}
            placement={'top'}
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
          >
            {displaySign}
          </Tooltip>
        </span>

        {showEditSignatureButton ? (
          <label
            className={'edit-btn'}
            style={{ right: '10px' }}
            onClick={() => {
              this.setState({ editSignMode: true });
            }}
          />
        ) : null}
      </div>
    );
  }

  public renderLikeMetalTipTitle() {
    const { likeDetail } = this.state;

    return (
      <div>
        {likeDetail.map(item => {
          return (
            <span key={item}>
              {item}
              <br />
            </span>
          );
        })}
      </div>
    );
  }

  public renderLikeMedal() {
    const { likeCount } = this.state;
    if (!likeCount) {
      return null;
    }

    return (
      <Tooltip
        title={this.renderLikeMetalTipTitle()}
        align={{ offset: [-15, 5] }}
        placement={'topLeft'}
        mouseEnterDelay={1.5}
        overlayClassName={'antd-tooltip-cover'}
      >
        <div>
          <label className={'like-medal-icon'} style={{ float: 'left' }} />
          <p className={'like-count'}>{likeCount}</p>
        </div>
      </Tooltip>
    );
  }

  public renderMedals() {
    const { likeCount } = this.state;
    if (!likeCount) {
      return null;
    }

    return <div className={'medal-div'}>{this.renderLikeMedal()}</div>;
  }

  public transferTimeZone = (timeZoneStr: string) => {
    const { i18n } = this.props;
    const fn = (num: number, length: number) => {
      return ('' + num).length < length
        ? (new Array(length + 1).join('0') + num).slice(-length)
        : '' + num;
    };

    let timeZone: any = parseFloat(timeZoneStr);
    if (!timeZone && timeZone !== 0) {
      return undefined;
    }

    timeZone = parseFloat(timeZone.toFixed(2));

    if (timeZone >= -12 && timeZone <= 14) {
      const date = new Date(Date.now() + timeZone * 60 * 60 * 1000);

      let hours = date.getUTCHours();
      const minutes = fn(date.getUTCMinutes(), 2);

      if (hours === 12) {
        return i18n('time_format_noon', ['12:' + minutes]);
      }
      if (hours === 0) {
        return i18n('time_format_midnight', ['12:' + minutes]);
      }
      if (hours < 12) {
        return i18n('time_format_am', [hours + ':' + minutes]);
      }
      if (hours > 12) {
        return i18n('time_format_pm', [(hours % 12) + ':' + minutes]);
      }
    }

    return undefined;
  };

  public nameEditComplete = async (textComplete: string | undefined) => {
    let text = textComplete;
    // if (text && text.length > nameLengthMax) {
    //   text = text.substr(0, nameLengthMax);
    // }
    if (this.state.newName === text) {
      this.setState({ editNameMode: false });
      return;
    }

    const oldName = this.state.newName;
    this.setState({ editNameMode: false, newName: text?.trim() || '' });
    const res = await (window as any).updateName((text || '').trim());
    if (!res) {
      // this.props?.closeSetting();
      this.setState({ editNameMode: false, newName: oldName });
    }
  };

  public renderName() {
    const { editNameMode, newName, showEditNameButton } = this.state;
    // const isMe = userInfo?.isMe;
    if (editNameMode) {
      return (
        <ProfileEditSignature
          content={newName}
          editName={true}
          onComplete={this.nameEditComplete}
        />
      );
    }

    return (
      <>
        <span
          className={'profile-name'}
          style={{
            width: '180px',
            pointerEvents: 'none',
            display: '-webkit-box',
            lineHeight: '24px',
            fontSize: '16px',
            fontWeight: 510,
            position: 'relative',
            padding: '24px 24px 0 0',
            wordBreak: 'break-word',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
          onMouseOver={this.mouseOverName}
          onMouseLeave={this.mouseLeaveName}
        >
          {newName}
        </span>
        {showEditNameButton ? (
          <label
            className={'edit-btn'}
            onClick={() => {
              this.setState({ editNameMode: true });
            }}
            style={{ right: '10px', top: 28 }}
          />
        ) : null}
        {this.state.showCopyName ? (
          <label
            className={'copy-btn'}
            style={{ right: '10px', top: 28 }}
            onClick={this.copyName}
          />
        ) : null}
      </>
    );
  }

  public renderTips() {
    const { tips } = this.state;
    if (!tips) {
      return null;
    }

    return <p className={'info-tips'}>{tips}</p>;
  }

  public renderProfileItemTime() {
    const { i18n } = this.props;
    const { userInfo } = this.state;
    const isMe = userInfo?.isMe;
    let timeZone = userInfo?.timeZone;
    let timeZoneChangeTypeNumber = Number(timeZone);
    let newTimeZone;
    if (timeZoneChangeTypeNumber >= 0) {
      newTimeZone = '+' + timeZoneChangeTypeNumber;
    } else {
      newTimeZone = timeZoneChangeTypeNumber;
    }

    if (isMe) {
      timeZone = -new Date().getTimezoneOffset() / 60 + '';
    }
    if (timeZone) {
      return (
        <ProfileItem
          isShowTip={false}
          isShowCopy={false}
          title={i18n('profile_time')}
          content={
            this.transferTimeZone(timeZone) + ' (UTC' + newTimeZone + ')'
          }
          onCopied={this.showCopiedTips}
          isRole={false}
        />
      );
    }
    return null;
  }

  public renderProfileItem(contentSource: any, item: ProfileItemProps) {
    const content = contentSource[item.field];

    if (content?.length) {
      return (
        <ProfileItem
          key={item.field}
          isShowTip={!!item.isShowTip}
          isShowCopy={!!item.isShowCopy}
          isShowArrowimg={!!item.isShowArrowimg}
          title={item?.title}
          content={content}
          onCopied={this.showCopiedTips}
          isRole={!!item.isRole}
          onClick={item.onClick}
          onClickArrowimg={item.onClickArrowimg}
        />
      );
    }
    return null;
  }

  public renderContactInfo() {
    const { i18n } = this.props;
    const { userInfo } = this.state;

    if (!userInfo) {
      return null;
    }
    const state = (window as any).inboxStore.getState();
    const { memberGroupLookup } = (state as StateType).conversations;
    const groups = memberGroupLookup[userInfo.id];

    let commonGroups: any;
    if (groups) {
      commonGroups = groups
        .map(id => getConversationProps(id))
        .filter(props => props.isAliveGroup);
    }
    const commonGroupNumber = commonGroups ? commonGroups.length : 0;
    userInfo.commonGroupNumber = commonGroupNumber.toString();

    const contactItems: Array<ProfileItemProps> = [];
    contactItems.push({
      field: 'uid',
      title: i18n('uid_name'),
      isShowCopy: false,
      isRole: false,
      isShowTip: false,
    });
    contactItems.push({
      field: 'joinedAt',
      title: i18n('joined_at'),
      isShowCopy: false,
      isRole: false,
      isShowTip: false,
    });
    if (!userInfo.isMe) {
      contactItems.push({
        field: 'met',
        title: i18n('how_you_met'),
        isShowCopy: false,
        isRole: false,
        isShowTip: false,
      });
      if (userInfo.commonGroupNumber !== '0') {
        contactItems.push({
          field: 'commonGroupNumber',
          title: i18n('common_groups'),
          isShowCopy: false,
          isRole: true,
          isShowTip: true,
          isShowArrowimg: true,
          onClickArrowimg: this.onClickCommonGroups,
        });
      } else {
        contactItems.push({
          field: 'commonGroupNumber',
          title: i18n('common_groups'),
          isShowCopy: false,
          isRole: false,
          isShowTip: false,
          isShowArrowimg: false,
        });
      }
    } else {
      // contactItems.push({
      //   field: 'email',
      //   title: i18n('profile_email'),
      //   isShowCopy: true,
      //   isRole: false,
      //   isShowTip: false,
      // });
      // contactItems.push({
      //   field: 'phoneNumber',
      //   title: "phone",
      //   isShowCopy: true,
      //   isRole: false,
      //   isShowTip: false,
      // });
    }

    // return (
    //   <div style={{ padding: '0px 0px', marginBottom: '16px' }}>
    //     <span
    //       className={'profile-item-title'}
    //       style={{
    //         float: 'left',
    //         margin: '0 0 12px 24px',
    //         fontWeight: 510,
    //       }}
    //     >
    //       {i18n('contact_info')}
    //     </span>

    //     {contactItems.map(item => this.renderProfileItem(userInfo, item))}
    //     {this.renderProfileItemTime()}
    //   </div>
    // );

    return (
      <div style={{ padding: '0px 0px', marginBottom: '16px' }}>
        {/* <span
          className={'profile-item-title'}
          style={{
            float: 'left',
            margin: '0 0 12px 24px',
            fontWeight: 510,
          }}
        >
          {i18n('contact_info')}
        </span> */}

        {contactItems.map(item => this.renderProfileItem(userInfo, item))}
      </div>
    );
  }

  public onClickLeaderItem = (event: any) => {
    event?.preventDefault();
    event?.stopPropagation();

    const { isLeaderCard, i18n } = this.props;

    if (isLeaderCard) {
      // update leader card
      const { userInfo } = this.state;

      const leaderId = userInfo?.protectedConfigs?.staff?.directParentNumber;
      if (!leaderId) {
        (window as any).noticeError(i18n('jumpFailed'));
        return;
      }
      this.updateUserInfoState(leaderId);
      this.updateUserStatusListener(leaderId);
      this.getOrUpdateLikeInfo(leaderId);
    } else {
      // show leader's profile dialog
      this.setState({ showLeaderProfile: true, dialogShownAt: Date.now() });
    }
  };

  public renderLeaderProfile() {
    const { userInfo, showLeaderProfile } = this.state;
    if (!showLeaderProfile) {
      return null;
    }

    const inner = window.innerWidth;
    const currRect = this.profileRef?.current?.getBoundingClientRect();
    if (!currRect) {
      return;
    }

    let x;
    let y;
    if (inner - currRect.right - 10 <= currRect.width) {
      x = currRect.left - currRect.width - 10;
      y = currRect.y;
    } else {
      x = currRect.right + 10;
      y = currRect.y;
    }

    const { i18n, isMarkDownCard } = this.props;
    const leaderId = userInfo?.protectedConfigs?.staff?.directParentNumber;
    if (!leaderId) {
      (window as any).noticeError(i18n('jumpFailed'));
      return;
    }

    return (
      <ProfileModal
        modelClassName="profile-modal-new"
        onClose={() => {
          this.setState({ showLeaderProfile: false });
        }}
      >
        <Profile
          id={leaderId}
          i18n={i18n}
          onClose={() => {
            this.setState({ showLeaderProfile: false });
          }}
          x={x}
          y={y}
          avatarPath={''}
          isLeaderCard={true}
          isMarkDownCard={isMarkDownCard ? true : false}
          dialogShownAt={this.state.dialogShownAt}
        />
      </ProfileModal>
    );
  }

  public renderOrganizationInfo() {
    const { i18n } = this.props;
    const { userInfo } = this.state;
    const business = userInfo?.protectedConfigs?.staff;
    if (!business) {
      return null;
    }

    const organizationItems: Array<ProfileItemProps> = [
      {
        field: 'roleNames',
        title: i18n('role'),
        isShowCopy: false,
        isRole: true,
        isShowTip: true,
      },
      {
        field: 'buNamePaths',
        title: i18n('bu'),
        isShowCopy: false,
        isRole: false,
        isShowTip: true,
      },
      {
        field: 'groupNamePaths',
        title: i18n('dept'),
        isShowCopy: false,
        isRole: false,
        isShowTip: true,
      },
      {
        field: 'directParentName',
        title: i18n('leader'),
        isShowCopy: true,
        isRole: false,
        isShowTip: false,
        onClick: this.onClickLeaderItem,
      },
      // {
      //   field: 'localParentName',
      //   title: i18n('dot_line'),
      //   isShowCopy: true,
      //   isRole: false,
      //   isShowTip: false,
      // },
    ];

    if (!organizationItems.some(item => !!business[item.field])) {
      return null;
    }

    return (
      <div
        style={{ padding: '0px 0px', marginBottom: '16px', marginTop: '24px' }}
      >
        <div>
          <span
            className={'profile-item-title'}
            style={{
              float: 'left',
              margin: '0 0 12px 24px',
              fontWeight: 510,
            }}
          >
            {i18n('organization_info')}
          </span>
        </div>

        {organizationItems.map(item => this.renderProfileItem(business, item))}
      </div>
    );
  }

  public renderProfileInfo() {
    //const { userInfo } = this.state;
    //const isMe = userInfo?.isMe;
    return (
      <div
        style={{ maxHeight: '394px', display: 'flex', flexDirection: 'column' }}
      >
        {this.renderSign()}
        {this.renderMedals()}
        <div className={'div-scroll'}>
          {/* {isMe ? this.renderContactInfo() : null} */}
          {this.renderContactInfo()}
          {this.renderOrganizationInfo()}
        </div>
      </div>
    );
  }

  public renderEmergencyBtn() {
    const { i18n, onClose, id } = this.props;
    const spookyBotId = (window as any).getGlobalConfig().spookyBotId;
    return (
      <>
        <button
          className={'emergency-btn'}
          onClick={async () => {
            onClose();
            await trigger('showConversation', spookyBotId);
            setTimeout(async () => {
              const conversation = await (
                window as any
              ).ConversationController.getOrCreateAndWait(
                spookyBotId,
                'private'
              );
              conversation.trigger('insert-at-person-msg', id, true);
            }, 300);
          }}
        >
          {i18n('emergencyBtn')}
        </button>
      </>
    );
  }

  public render() {
    let {
      x,
      y,
      i18n,
      id,
      avatarPath,
      isLeaderCard,
      allowUpload,
      isMarkDownCard,
    } = this.props;

    const { userInfo, newName } = this.state;
    const isMe = userInfo?.isMe;
    const spookyBotFlag = userInfo?.spookyBotFlag;

    return (
      <div
        ref={this.profileRef}
        className={'profile-dialog'}
        style={{
          // height: '548px',
          width: '280px',
          marginLeft: !isMarkDownCard ? x + 'px' : '0',
          marginTop: !isMarkDownCard ? y + 'px' : '0',
          left: isMarkDownCard ? x + 'px' : '0',
          top: isMarkDownCard ? y + 'px' : '0',
          position: !isMarkDownCard ? 'relative' : 'absolute',
          paddingRight: '2px',
          padding: '0',
          // float:'left'
        }}
        onClick={event => {
          // event.preventDefault();
          event.stopPropagation();
          if (!isLeaderCard) {
            this.setState({ showLeaderProfile: false });
          }
        }}
      >
        {this.renderTips()}
        <div style={{ maxHeight: '104px', paddingBottom: '8px' }}>
          <input
            type={'file'}
            ref={this.inputRefImageSelect}
            accept={'image/png, image/jpg, image/bmp, image/gif'}
            style={{ position: 'absolute', display: 'none' }}
            onChange={this.inputImageSelectChange}
          />
          {this.renderTestImage()}
          <div>
            <div
              style={{
                width: 'fit-content',
                display: 'inline-block',
                padding: '24px 0 8px 24px',
              }}
            >
              <Avatar
                id={userInfo?.id || id}
                conversationType={'direct'}
                i18n={i18n}
                size={56}
                avatarPath={userInfo?.avatarPath || avatarPath}
                name={newName}
                canUpload={
                  isMe && allowUpload ? this.inputUploadImage : undefined
                }
                canPreviewAvatar={!isMe || !allowUpload}
                noClickEvent={true}
              />
            </div>
            <div
              style={{
                width: '180px',
                height: '48px',
                margin: '0 auto ',
                float: 'right',
              }}
              onMouseOver={this.mouseOverName}
              onMouseLeave={this.mouseLeaveName}
            >
              {this.renderName()}
              {this.renderStatus()}
            </div>
            {/*{ (newSignature ||isMe)  ? this.renderSign() : null}*/}
          </div>
        </div>
        {this.renderProfileInfo()}
        {spookyBotFlag && this.renderEmergencyBtn()}

        <div style={{ height: '52px', marginTop: '5px' }}>
          <div className={'bottom-div'}>
            {/* <Tooltip
                title={i18n('like')}
                placement={'top'}
                mouseEnterDelay={1.5}
                overlayClassName={'antd-tooltip-cover'}
              >
                <label
                  className={'like-btn'}
                  style={{ float: 'left' }}
                  onClick={this.like}
                />
              </Tooltip> */}
            <Tooltip
              title={i18n('chat')}
              placement={'top'}
              mouseEnterDelay={1.5}
              overlayClassName={'antd-tooltip-cover'}
            >
              <label
                className={'chat-btn'}
                // style={{ float: 'left', margin: '16px 0 0 35px' }}
                onClick={this.openChat}
              />
            </Tooltip>
            {/* {isMe || isBot ? null : (
              <Tooltip
                title={i18n('call')}
                placement={'top'}
                mouseEnterDelay={1.5}
                overlayClassName={'antd-tooltip-cover'}
              >
                <label
                  className={'voice-btn'}
                  // style={{ margin: '16px 0 0 45px', float: 'left' }}
                  onClick={this.openVoice}
                />
              </Tooltip>
            )} */}
            <Tooltip
              title={i18n('forward')}
              placement={'top'}
              mouseEnterDelay={1.5}
              overlayClassName={'antd-tooltip-cover'}
            >
              <label
                className={'share-btn'}
                style={{ float: 'right' }}
                onClick={this.shareContact}
              />
            </Tooltip>
          </div>
        </div>
        {this.renderLeaderProfile()}
      </div>
    );
  }
}
