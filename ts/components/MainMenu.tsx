import React from 'react';
import { Avatar } from './Avatar';
import { LocalizerType } from '../types/Util';
import { ForwardDialog } from './ForwardDialog';
import { FolderSelectConversationDialog } from './FolderSelectConversationDialog';
import { FolderSelectOwnerDialog } from './FolderSelectOwnerDialog';
import { Tooltip, Drawer, Popover } from 'antd';
import Load from './globalComponents/Load';
import { CommonSetting } from './commonSettings/CommonSetting';
import ProfileModal from './commonSettings/ProfileModal';
import { Profile } from './commonSettings/Profile';
import {
  CurrentDockItemChangedActionType,
  DockItemType,
} from '../state/ducks/dock';

export interface Props {
  // To be used as an ID
  id: string;
  regionCode: string;

  // For display
  isMe: boolean;
  name?: string;
  color: string;
  verified: boolean;
  profileName?: string;
  avatarPath?: string;
  i18n: LocalizerType;
  ourNumber: string;
  clearSearch: () => void;
  currentDockItemChanged: (
    current: DockItemType
  ) => CurrentDockItemChangedActionType;
}

interface State {
  barState: number; // 0-chat 1-contact 2-task
  redCount: number;
  greyCount: number;
  showForwardDialog: boolean;
  showFolderSelectConversationDialog: boolean;
  showFolderSelectOwnerDialog: boolean;
  isBarOperation: any;
  folderName: string;
  conversations: any;
  selectedConversation: any;
  user: string;
  showTaskRedPoint: boolean;
  showCommonSetting?: boolean;
  showProfileDialog?: boolean;
  updateButton?: boolean;
  profileUid: string;
  pos: any;
  card: any;
  miniProgramIcon: boolean;
  folderConditions: any;
  allowUpload: boolean;

  selectedOwners: any;
  privateConversations: any;
}

export class MainMenu extends React.Component<Props, State> {
  constructor(props: Readonly<Props>) {
    super(props);

    let miniProgramIcon = false;
    if ((window as any).getMiniProgramList) {
      const l = (window as any).getMiniProgramList() || [];
      miniProgramIcon = l.length > 0;
    }

    this.state = {
      barState: 0,
      redCount: 0,
      greyCount: 0,
      showForwardDialog: false,
      showFolderSelectConversationDialog: false,
      showFolderSelectOwnerDialog: false,
      isBarOperation: false,
      folderName: '',
      conversations: [],
      selectedConversation: [],
      user: '',
      showTaskRedPoint: false,
      profileUid: '',
      pos: undefined,
      card: undefined,
      miniProgramIcon,
      folderConditions: undefined,
      allowUpload: true,
      showCommonSetting: false,
      showProfileDialog: false,
      updateButton: false,
      selectedOwners: [],
      privateConversations: [],
    };
  }

  public componentDidMount = () => {
    window.addEventListener(
      'main-header-set-badge-count',
      this.updateBadgeCount
    );
    window.addEventListener(
      'main-header-set-task-red-point',
      this.setTaskRedPoint
    );
    (window as any).queryBadgeCount();
    window.addEventListener(
      'event-toggle-switch-chat',
      this.toggleButtonSwitchChat
    );
    (window as any).registerSearchUser((infos: any) => {
      const info = infos.userId || infos;
      const isMac = infos.isMac;
      const extern = infos.extern;
      const conversationsCollection = (window as any).getConversations();
      const conversations = conversationsCollection.map(
        (conversation: { cachedProps: any }) => conversation.cachedProps
      );
      const lookup = (window as any).Signal.Util.makeLookup(
        conversations,
        'id'
      );
      if (lookup.hasOwnProperty(info)) {
        const item = lookup[info];
        (window as any).sendSearchUser({
          id: info,
          name: item.name || item.id,
          avatar: item.avatarPath,
          isMac,
          extern,
        });
      } else {
        (window as any).sendSearchUser({ id: info, name: info, isMac, extern });
      }
    });

    // show forward profile
    window.addEventListener('event-share-user-contact', this.showUserContact);

    window.addEventListener('event-share-mini-program', this.shareMiniProgram);

    // show Folder conversation selector
    window.addEventListener(
      'folder-add-conversation',
      this.showFolderConversationSelector
    );

    // show Folder Group Owner selector
    window.addEventListener(
      'folder-condition-add-group-owners',
      this.showFolderOwnerSelector
    );

    window.addEventListener(
      'hide-conversation-dialog',
      this.hideFolderConversationSelector
    );

    window.addEventListener(
      'open-profile-with-position',
      this.openProfileCenter
    );
    window.addEventListener(
      'got-mini-program-list',
      this.updateMiniProgramList
    );
    window.addEventListener('event-open-user-setting', this.openCommonSetting);
    window.addEventListener('event-show-update-button', this.ShowUpdateButton);
  };

  public componentWillUnmount() {
    window.removeEventListener(
      'main-header-set-badge-count',
      this.updateBadgeCount
    );
    window.removeEventListener(
      'main-header-set-task-red-point',
      this.setTaskRedPoint
    );
    window.removeEventListener(
      'event-toggle-switch-chat',
      this.toggleButtonSwitchChat
    );
    (window as any).registerSearchUser(null);
    window.removeEventListener(
      'event-share-user-contact',
      this.showUserContact
    );
    window.removeEventListener(
      'folder-add-conversation',
      this.showFolderConversationSelector
    );
    // show Folder Group Owner selector
    window.removeEventListener(
      'folder-condition-add-group-owners',
      this.showFolderOwnerSelector
    );

    window.removeEventListener(
      'hide-conversation-dialog',
      this.hideFolderConversationSelector
    );

    window.removeEventListener(
      'open-profile-with-position',
      this.openProfileCenter
    );
    window.removeEventListener(
      'got-mini-program-list',
      this.updateMiniProgramList
    );
    window.removeEventListener(
      'event-open-user-setting',
      this.openCommonSetting
    );
    window.removeEventListener(
      'event-show-update-button',
      this.ShowUpdateButton
    );
  }

  public renderUnreadCount() {
    const { redCount, greyCount } = this.state;
    if (redCount || greyCount) {
      let right = '17px';
      if (
        (redCount && redCount > 99) ||
        (!redCount && greyCount && greyCount > 99)
      ) {
        right = '10px';
      }
      return (
        <div
          className={
            redCount
              ? 'module-conversation-list-item__unread-count'
              : 'module-conversation-list-item__unread-count-mute'
          }
          style={{ right, top: '42px', fontSize: '10px', lineHeight: '15.7px' }}
        >
          {redCount
            ? redCount > 99
              ? '99+'
              : redCount
            : greyCount > 99
            ? '99+'
            : greyCount}
        </div>
      );
    }
    return null;
  }

  public renderTaskRedPointer() {
    if (!this.state.showTaskRedPoint) {
      return null;
    }
    return (
      <div
        className="module-conversation-list-item__unread-count"
        style={{ right: '20px', top: '158px', minWidth: 8, height: 8 }}
      />
    );
  }

  public renderForwardDialog() {
    const { showForwardDialog, user, conversations, card } = this.state;
    if (!showForwardDialog) {
      return null;
    }

    const { i18n } = this.props;

    if (card) {
      return (
        <ForwardDialog
          i18n={i18n}
          conversations={conversations}
          onForwardTo={this.onForwardMiniProgram}
          onClose={this.closeForwardDialog}
          onCancel={this.closeForwardDialog}
          card={card}
        />
      );
    } else {
      return (
        <ForwardDialog
          i18n={i18n}
          onForwardToContact={this.onForwardToContact}
          sendContact={user}
          conversations={conversations}
          onClose={this.closeForwardDialog}
          onCancel={this.closeForwardDialog}
        />
      );
    }
  }

  public renderFolderSelectConversationDialog() {
    const {
      showFolderSelectConversationDialog,
      conversations,
      selectedConversation,
      folderName,
      isBarOperation,
    } = this.state;
    if (!showFolderSelectConversationDialog) {
      return null;
    }

    const { i18n } = this.props;

    return (
      <FolderSelectConversationDialog
        i18n={i18n}
        isBarOperation={isBarOperation}
        folderName={folderName}
        conversations={conversations}
        selectedConversation={selectedConversation}
        onCancel={this.closeConversationSelectorDialog}
      />
    );
  }

  public renderFolderSelectOwnerDialog() {
    const {
      showFolderSelectOwnerDialog,
      privateConversations,
      selectedOwners,
    } = this.state;
    if (!showFolderSelectOwnerDialog) {
      return null;
    }
    const { i18n } = this.props;
    return (
      <FolderSelectOwnerDialog
        i18n={i18n}
        privateConversations={privateConversations}
        selectedOwners={selectedOwners}
        onCancel={this.closeConversationOwnerDialog}
      />
    );
  }

  public renderUpdateButtonContent = () => {
    const { i18n } = this.props;
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'white',
          fontSize: '12px',
          backgroundColor: '#056FFA',
          height: 32,
          width: 85,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
        }}
        onClick={() => {
          const ret = confirm(i18n('autoUpdateNewVersionMessageInstall'));
          if (ret) {
            (window as any).updateWillReboot();
          }
        }}
      >
        <span className={'update-button-icon--reboot'}></span>
        <span>{i18n('Update')}</span>
      </div>
    );
  };

  public renderUpdateButton = () => {
    const { updateButton } = this.state;
    return (
      <Popover
        overlayClassName={'update-button-card--popover'}
        content={this.renderUpdateButtonContent()}
        open={updateButton}
        placement="right"
      >
        <div
          style={{
            width: 1,
            height: 1,
            position: 'absolute',
            left: -20,
            bottom: 135,
          }}
        ></div>
      </Popover>
    );
  };

  public render() {
    const { avatarPath, i18n, color, name, profileName, id, ourNumber } =
      this.props;
    const { showCommonSetting } = this.state;
    // 切换账号时，可能出现id=undefined, 需要过滤掉这种情况
    if (!id) {
      return null;
    }

    let buttons = (
      <div>
        {/* 解决切换的时候会闪烁 */}
        <div
          style={{ position: 'absolute', left: '-100px' }}
          role="button"
          className="module-first-pane-difft-icon"
        />
        <div
          style={{ position: 'absolute', left: '-100px' }}
          role="button"
          className="module-first-pane-contact-icon-blue"
        />
        <div
          style={{ position: 'absolute', left: '-100px' }}
          role="button"
          className="module-first-pane-task-icon-blue"
        />
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="leftTop"
          title={i18n('mainMenuMessagesTooltip')}
        >
          <div
            role="button"
            onClick={() => {
              this.toggleButtonState(0);
              const myEvent = new CustomEvent('event-scroll-to-unread-message');
              window.dispatchEvent(myEvent);
            }}
            className={
              this.state.barState === 0
                ? 'module-first-pane-difft-icon-blue'
                : 'module-first-pane-difft-icon'
            }
          />
        </Tooltip>
        {this.renderUnreadCount()}
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="leftTop"
          title={i18n('mainMenuContactTooltip')}
        >
          <div
            role="button"
            onClick={() => this.toggleButtonState(1)}
            className={
              this.state.barState === 1
                ? 'module-first-pane-contact-icon-blue'
                : 'module-first-pane-contact-icon'
            }
          />
        </Tooltip>
        {/* <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="leftTop"
          title={i18n('mainMenuTaskTooltip')}
        >
          <div
            role="button"
            onClick={() => this.toggleButtonState(2)}
            className={
              this.state.barState === 2
                ? 'module-first-pane-task-icon-blue'
                : 'module-first-pane-task-icon'
            }
          />
        </Tooltip>
        {this.renderTaskRedPointer()} */}
        {this.state.miniProgramIcon ? (
          <Tooltip
            mouseEnterDelay={1.5}
            overlayClassName={'antd-tooltip-cover'}
            placement="leftTop"
            title={i18n('mainMenuWorkspaceTooltip')}
          >
            <div
              role="button"
              onClick={() => this.toggleButtonState(3)}
              className={
                this.state.barState === 3
                  ? 'module-first-pane-workspace-icon-blue'
                  : 'module-first-pane-workspace-icon'
              }
            />
          </Tooltip>
        ) : null}
      </div>
    );
    return (
      <div className="module-main-menu">
        <Load i18n={i18n} ourNumber={ourNumber} />
        <div style={{ width: 'fit-content', margin: 'auto' }}>
          <Avatar
            id={id}
            avatarPath={avatarPath}
            color={color}
            conversationType="direct"
            i18n={i18n}
            name={name}
            profileName={profileName}
            size={36}
            isCanUpload={true}
            noClickEvent={true}
            fromMainTab={true}
            onClickAvatar={() => {
              if (showCommonSetting) {
                this.setState({
                  showCommonSetting: false,
                });
              } else {
                this.setState({ showCommonSetting: true });
              }
            }}
          />
        </div>
        <div className="div-buttons">
          {buttons}
          {/*<Tooltip*/}
          {/*  mouseEnterDelay={1.5}*/}
          {/*  overlayClassName={'antd-tooltip-cover'}*/}
          {/*  placement="leftTop"*/}
          {/*  title={i18n('settingsTooltip')}*/}
          {/*>*/}
          {/*</Tooltip>*/}
          {this.renderUpdateButton()}
        </div>
        {this.renderForwardDialog()}
        {this.renderFolderSelectConversationDialog()}
        {this.renderFolderSelectOwnerDialog()}
        {this.renderCommonSetting()}
        {this.renderProfileDialog()}
      </div>
    );
  }

  private readonly toggleButtonState = (index: number) => {
    const { clearSearch, currentDockItemChanged } = this.props;
    const { showCommonSetting } = this.state;
    if (showCommonSetting) {
      this.setState({ showCommonSetting: false });
    }
    if (clearSearch) {
      clearSearch();
    }
    if (this.state.barState === index) {
      return;
    }

    // chat
    const gutter = document.getElementsByClassName('gutter')[0] as any;
    const conversationStack = document.getElementsByClassName(
      'conversation-stack'
    )[0] as any;

    const contactColumn = document.getElementsByClassName(
      'contact-column'
    )[0] as any;
    const taskPane = document.getElementsByClassName(
      'task-list-pane'
    )[0] as any;
    const workSpacePane = document.getElementsByClassName(
      'work-space-pane'
    )[0] as any;

    if (index === 0) {
      // chat
      gutter.style.display = 'block';
      conversationStack.style.display = 'block';

      contactColumn.style.display = 'none';
      taskPane.style.display = 'none';
      workSpacePane.style.display = 'none';

      (window as any).displayMpSideView(false);
      (window as any).displayMpInSideView(true);

      currentDockItemChanged('chat');
    } else if (index === 1) {
      gutter.style.display = 'none';
      conversationStack.style.display = 'none';

      contactColumn.style.display = 'block';
      taskPane.style.display = 'none';
      workSpacePane.style.display = 'none';

      (window as any).displayMpSideView(false);
      (window as any).displayMpInSideView(false);

      currentDockItemChanged('contact');
    } else if (index === 2) {
      gutter.style.display = 'none';
      conversationStack.style.display = 'none';

      contactColumn.style.display = 'none';
      taskPane.style.display = 'block';
      workSpacePane.style.display = 'none';

      (window as any).displayMpSideView(false);
      (window as any).displayMpInSideView(false);

      currentDockItemChanged('task');
    } else if (index === 3) {
      gutter.style.display = 'none';
      conversationStack.style.display = 'none';

      contactColumn.style.display = 'none';
      taskPane.style.display = 'none';
      workSpacePane.style.display = 'block';

      (window as any).displayMpSideView(true);
      (window as any).displayMpInSideView(false);

      currentDockItemChanged('workspace');
    } else {
      currentDockItemChanged('others');
    }

    this.setState({
      barState: index,
    });
  };

  private readonly toggleButtonSwitchChat = () => {
    this.toggleButtonState(0);
  };

  private updateBadgeCount = (ev: any) => {
    const { redCount, greyCount } = ev.detail;
    this.setState(() => ({
      redCount,
      greyCount,
    }));
  };

  private setTaskRedPoint = (ev: any) => {
    this.setState({ showTaskRedPoint: ev.detail > 0 });
  };

  public showFolderConversationSelector = (event: any) => {
    this.setState({
      selectedConversation: event?.detail[0],
      conversations: event?.detail[1],
      folderName: event?.detail[2],
      isBarOperation: event?.detail[3],
      showFolderSelectConversationDialog: true,
    });
  };

  public showFolderOwnerSelector = (event: any) => {
    const { privateConversations, selectedOwners } = event?.detail || {};
    this.setState({
      showFolderSelectOwnerDialog: true,
      selectedOwners,
      privateConversations,
    });
  };

  public hideFolderConversationSelector = () => {
    this.setState({ showFolderSelectConversationDialog: false });
  };

  public closeForwardDialog = () => {
    this.setState({ showForwardDialog: false });
  };

  public closeConversationSelectorDialog = () => {
    this.setState({
      showFolderSelectConversationDialog: false,
    });
  };

  public closeConversationOwnerDialog = () => {
    this.setState({
      showFolderSelectOwnerDialog: false,
    });
  };

  public openProfileCenter = (ev: any) => {
    if (ev && ev.detail && ev.detail.uid) {
      const pos = ev.detail.pos || { x: 200, y: 200 };
      this.setState({
        showProfileDialog: true,
        profileUid: ev.detail.uid,
        pos,
      });
    }
  };

  private updateMiniProgramList = (ev: any) => {
    console.log('MainMenu.tsx updateMiniProgramList', ev?.detail);
    if (!ev || !ev.detail) {
      return;
    }

    this.setState({ miniProgramIcon: ev.detail.length });
  };

  public onForwardToContact = async (
    conversationIds?: Array<string>,
    user?: any
  ) => {
    if (conversationIds && conversationIds.length) {
      for (let i = 0; i < conversationIds.length; i++) {
        const c = await (
          window as any
        ).ConversationController.getOrCreateAndWait(
          conversationIds[i],
          'private'
        );
        if (c) {
          await c.forceSendMessageAuto('', null, [], null, null, null, null, [
            user,
          ]);
        }
      }
    }
  };

  public onForwardMiniProgram = async (conversationIds?: Array<string>) => {
    const { card } = this.state;
    if (conversationIds && conversationIds.length) {
      for (let i = 0; i < conversationIds.length; i++) {
        const c = await (
          window as any
        ).ConversationController.getOrCreateAndWait(
          conversationIds[i],
          'private'
        );

        if (c) {
          await c.forceSendMessageAuto(
            null,
            null,
            [],
            null,
            null,
            null,
            null,
            null,
            null,
            { card }
          );
        }
      }
    }
  };

  private readonly showUserContact = (ev: any) => {
    const conversations = (window as any).getConversations();
    const filterConversations = [];
    const { length } = conversations.models;
    for (let i = 0; i < length; i += 1) {
      filterConversations.push(conversations.models[i].cachedProps);
    }

    this.setState({
      showForwardDialog: true,
      conversations: filterConversations,
      user: ev.detail,
      card: undefined,
    });
  };

  private readonly shareMiniProgram = (ev: any) => {
    const conversations = (window as any).getConversations();
    const filterConversations = [];
    const { length } = conversations.models;
    for (let i = 0; i < length; i += 1) {
      filterConversations.push(conversations.models[i].cachedProps);
    }
    this.setState({
      showForwardDialog: true,
      conversations: filterConversations,
      card: ev.detail,
      user: '',
    });
  };

  private readonly ShowUpdateButton = () => {
    this.setState({ updateButton: true });
  };

  public openCommonSetting = () => {
    this.setState({ showCommonSetting: true });
  };

  public renderCommonSetting() {
    const { showCommonSetting } = this.state;
    const { avatarPath, i18n, name, id } = this.props;

    const closeSetting = () => {
      this.setState({ showCommonSetting: false });
    };

    if (showCommonSetting) {
      return (
        <Drawer
          placement="left"
          open={this.state.showCommonSetting}
          width={300}
          closable={false}
          contentWrapperStyle={{ boxShadow: 'none' }}
          style={{ marginLeft: 68, padding: 0 }}
          mask={false}
          push={{ distance: '0' }}
        >
          <CommonSetting
            id={id}
            avatarPath={avatarPath}
            name={name}
            i18n={i18n}
            closeSetting={closeSetting}
          />
        </Drawer>
      );
    } else {
      return null;
    }
  }

  public renderProfileDialog = () => {
    const { i18n } = this.props;
    const { showProfileDialog, profileUid, pos } = this.state;
    if (!showProfileDialog || !profileUid) {
      return;
    }

    return (
      <ProfileModal
        onClose={() => {
          this.setState({ showProfileDialog: false });
        }}
      >
        <Profile
          id={profileUid}
          i18n={i18n}
          onClose={() => {
            this.setState({ showProfileDialog: false });
          }}
          isLeaderCard={false}
          isMarkDownCard={true}
          x={pos.x}
          y={pos.y}
          avatarPath={''}
        />
      </ProfileModal>
    );
  };
}
