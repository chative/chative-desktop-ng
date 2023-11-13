import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { PropsData as ConversationListItemPropsType } from '../ConversationListItem';
import { LocalizerType } from '../../types/Util';
import { Avatar } from '../Avatar';
import _ from 'lodash';
import { Tag } from '../Tag';
type Props = {
  contact: Array<any>;
  chatFolders: Array<ChatFolderType>;
  i18n: LocalizerType;
  onClose: () => void;
  operationType: string;
  updateOrCreate: (
    chatFolders: Array<ChatFolderType>,
    operationType: string,
    folderName?: string,
    isRecommended?: boolean
  ) => void;
  changeOperationType: (operationType: string) => void;
  handleClickToEdit: (folderId: string) => void;
  onRef: any;
  maxFolderCount: number;
  activeConversations: any;
  ourNumber: any;
};

type ChatFolderType = {
  name: string;
  cIds: Array<any>;
  conditions?: any;
  type?: any;
};

const MAX_FOLDER_NAME_LENGTH = 12;
const MAX_FOLDER_KEYWORD_LENGTH = 64;
const RECOMMEND_FOLDER_NAMES = [
  '@Me',
  '@我',
  'Private',
  '私聊',
  'Unread',
  '未读',
];

export default function ChatFolders(props: Props) {
  const preCheckFolder = useRef('');
  const preTurn = useRef([] as Array<string>);
  const [selectedConversations, setSelectedConversations] = useState<any>();
  const [beforeFolderName, setBeforeFolderName] = useState('');
  const [currentFolderName, setCurrentFolderName] = useState('');
  const [beforeFolderCids, setBeforeFolderCids] = useState<any>();
  const [beforeFolderConditions, setBeforeFolderConditions] = useState(
    {} as any
  );
  const [folderConditions, setFolderConditions] = useState({} as any);
  const [shakeTimer, setShakeTimer] = useState(0);
  const [recommendFolderList, setRecommendFolderList] = useState([]);
  const [currentEditFolder, setCurrentEditFolder] = useState({} as any);
  const [currentKeywords, setCurrentKeywords] = useState('');
  useEffect(() => {
    const initList = [
      {
        name: 'Unread',
        cIds: [],
        type: 0,
      },
      {
        name: '@Me',
        cIds: [],
        type: 0,
      },
      {
        name: 'Private',
        cIds: [],
        type: 0,
      },
    ];
    const signalNames =
      props?.chatFolders?.filter(f => f?.type === 0)?.map(e => e.name) || [];

    const result = [] as any;
    for (let i = 0; i < initList.length; i++) {
      if (!signalNames.includes(initList[i].name)) {
        result.push(initList[i]);
      }
    }
    setRecommendFolderList(result);
  }, [props.chatFolders]);

  useImperativeHandle(props.onRef, () => {
    return {
      initEditFolderData: (
        selectedConversations: any,
        name: string,
        conditions: any
      ) => {
        setSelectedConversations(selectedConversations);
        const folderInput = document.querySelector(
          '#folder-name-input'
        ) as HTMLInputElement;
        if (folderInput) {
          folderInput.value = name;
        }
        setBeforeFolderName(name);
        setCurrentFolderName(name);
        const cIds = selectedConversations?.map((c: any) => c?.id) || [];
        setBeforeFolderCids(cIds);
        setFolderConditions(conditions);
        setBeforeFolderConditions(conditions);
        const { keywords } = conditions || {};
        if (keywords) {
          setCurrentKeywords(keywords);
        }
      },
    };
  });

  const MouseDown = (event: MouseEvent) => {
    if (event && event.button === 2) {
      const element = event.target as HTMLElement;
      const id = element.getAttribute('id') || '';
      preCheckFolder.current = id;

      if (id === 'folder-condition-keywords') return;
      if (!id || id === 'click-to-edit-folder') {
        $('.folder-operation-menu').css('display', 'none');
        return;
      }

      const folder = props.chatFolders.find(f => f.name === id.slice(0, -4));
      setCurrentEditFolder(folder);
    }
  };

  const handleClick = () => {
    $('.folder-operation-menu').css('display', 'none');
  };

  useEffect(() => {
    window.addEventListener('mousedown', MouseDown);
    window.addEventListener('click', handleClick);
    window.addEventListener('check-selected', onCompleteSelect);
    window.addEventListener(
      'group-owner-check-selected',
      groupOwnerCompleteSelect
    );
    window.addEventListener('check-folder-conditions', onCheckConditions);
    return () => {
      window.removeEventListener('mousedown', MouseDown);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('check-selected', onCompleteSelect);
      window.removeEventListener(
        'group-owner-check-selected',
        groupOwnerCompleteSelect
      );
      window.removeEventListener('check-folder-conditions', onCheckConditions);
    };
  }, []);

  useEffect(() => {
    const items = document.querySelectorAll('.folder-drag-li-item') as any;
    const dragUl = document.querySelector('.folder-drag-ul') as any;
    for (let i = 0; i < items.length; i++) {
      items[i].id = props.chatFolders[i].name + 'drag';

      items[i].ondragstart = function (e: any) {
        e.dataTransfer.setData('id', this.id);
      };

      items[i].ondragover = function () {
        return false;
      };
      items[i].ondrop = function (e: any) {
        const id = e.dataTransfer.getData('id');
        const tuo = document.getElementById(id);

        dragUl.insertBefore(tuo, this);
        this.style.borderTop = '0px solid #666ccc';

        const LI = dragUl.childNodes;
        const folderNames = [] as any;
        LI.forEach((item: any) => {
          folderNames.push(item.getAttribute('id').slice(0, -4));
        });

        if (preTurn.current.join('') === folderNames.join('')) {
          console.log('the folder turn have not change,skip...');
          return;
        }

        preTurn.current = folderNames;
        const newChatFolders = [] as Array<ChatFolderType>;
        if (folderNames.length > 0) {
          for (let i = 0; i < folderNames.length; i++) {
            for (let j = 0; j < props.chatFolders.length; j++) {
              if (folderNames[i] === props.chatFolders[j].name) {
                newChatFolders.push(props.chatFolders[j]);
              }
            }
          }
        }
        props.updateOrCreate([...newChatFolders], 'detail');
      };

      items[i].ondragenter = function () {
        this.style.borderTop = '2px solid rgb(27,144,234)';
      };

      items[i].ondragleave = function () {
        this.style.borderTop = '0px solid #666ccc';
      };
    }
  });

  useEffect(() => {
    preTurn.current = props.chatFolders?.map(f => f.name) || [];

    const folder =
      props.chatFolders?.filter(
        f => f.name === beforeFolderName && f?.type !== 0
      )[0] || ({} as any);
    const conditions = folder?.conditions || {};
    setFolderConditions(conditions);
  }, [props.chatFolders]);

  const onCompleteSelect = (event: any) => {
    setSelectedConversations([...event.detail]);
  };

  const groupOwnerCompleteSelect = (event: any) => {
    const conditions = {} as any;
    const selectedOwners = event?.detail || [];
    const groupOwners = selectedOwners.map((owner: any) => owner.id)?.join(',');
    conditions['groupOwners'] = groupOwners;
    const keywords =
      (document.getElementById('folder-keywords') as any).value?.trim() || '';
    conditions['keywords'] = keywords;
    setFolderConditions(conditions);
  };

  const onCheckConditions = (event: any) => {
    setFolderConditions({ ...event.detail });
  };

  function initCreateData() {
    setSelectedConversations([]);
    setBeforeFolderCids([]);
    setFolderConditions({});
    setBeforeFolderConditions({});
    setBeforeFolderName('');
    setCurrentKeywords('');
    setCurrentFolderName('');
  }

  function renderHeader() {
    const { i18n, operationType } = props;
    let doneStyle =
      currentFolderName.length > 0 &&
      ((selectedConversations && selectedConversations.length) > 0 ||
        currentKeywords ||
        (folderConditions?.groupOwners &&
          folderConditions?.groupOwners?.length) > 0)
        ? {
            cursor: 'pointer',
          }
        : {
            cursor: 'not-allowed',
            color: 'grey',
          };

    if (
      (currentKeywords && currentKeywords.length < 2) ||
      currentKeywords.length > 64
    ) {
      doneStyle = {
        cursor: 'not-allowed',
        color: 'grey',
      };
    }

    return (
      <div className={'chat-folders-header'}>
        <div className={'chat-folders-header-back'}>
          <div
            className={'chat-folders-header-back-icon'}
            onClick={() => {
              handleBack(false);
            }}
          />
          <div className={'chat-folders-header-back-title'}>
            {operationType === 'detail' ? i18n('exit') : i18n('back')}
          </div>
        </div>
        <div className={'chat-folders-header-title'}>
          <span>
            {operationType === 'detail'
              ? i18n('chat_folders')
              : operationType === 'create'
              ? i18n('create_folder')
              : operationType === 'edit'
              ? i18n('edit_folder')
              : null}
          </span>
        </div>
        {operationType !== 'detail' && (
          <div className={'chat-folders-header-done'}>
            <b style={doneStyle} onClick={handleCreateOrUpdate}>
              {i18n('edit_folder_done')}
            </b>
          </div>
        )}
      </div>
    );
  }

  function renderDetail() {
    const { chatFolders, i18n, maxFolderCount } = props;
    return (
      <div className={'chat-folders-body'}>
        {chatFolders && chatFolders.length > 0 ? (
          <div style={{ fontSize: '14px' }}>
            <span>{i18n('my_folders')}</span>
          </div>
        ) : (
          <div
            style={{
              fontSize: '14px',
              marginLeft: '3px',
              marginTop: '5px',
              color: 'grey',
            }}
          >
            <span>{i18n('add_folder_tip')}</span>
          </div>
        )}
        {chatFolders && chatFolders.length > 0 && renderDragFolderList()}
        {chatFolders?.filter(f => f.type !== 0)?.length < maxFolderCount &&
          renderAddFolder()}
        {renderRecommendFolderList()}
      </div>
    );
  }

  function renderAction() {
    const { i18n, operationType } = props;
    const tipStyle = {
      fontSize: '14px',
      paddingLeft: '2px',
      color: 'grey',
      marginTop: '10px',
    };
    return (
      <div className={'chat-folders-body'}>
        {renderFolderNameInput()}
        <div className={'folder-included-chats'}>{i18n('included_chats')}</div>
        {renderFolderAddConversation()}
        {selectedConversations &&
          selectedConversations.length > 0 &&
          renderConversationList()}
        {operationType === 'create' &&
          (!selectedConversations || selectedConversations.length === 0) && (
            <div style={tipStyle}>
              <span>{i18n('add_chats_tip')}</span>
            </div>
          )}
        {operationType === 'edit' &&
          (!selectedConversations || selectedConversations.length === 0) && (
            <div style={tipStyle}>
              <span>{i18n('edit_folder_nochat_tip')}</span>
            </div>
          )}
        <div className={'folder-condition'}>
          <div className={'folder-included-condition'}>
            {i18n('included_conditions')}
          </div>
          {renderConditions()}
        </div>
      </div>
    );
  }

  function renderConditions() {
    const { i18n } = props;
    return (
      <div style={{ paddingLeft: '7px' }}>
        <table className={'condition-table'}>
          <tbody>
            <tr className={'condition-tr'}>
              <td className={'condition-td1'}>{i18n('keywords')}</td>
              <td className={'condition-td2'}>
                <input
                  className={'keyword-input'}
                  defaultValue={folderConditions?.keywords}
                  id={'folder-keywords'}
                  type="text"
                  onKeyUp={() => {
                    checkConditionKeywords(
                      'folder-keywords',
                      MAX_FOLDER_KEYWORD_LENGTH
                    );
                  }}
                  onKeyDown={() => {
                    checkConditionKeywords(
                      'folder-keywords',
                      MAX_FOLDER_KEYWORD_LENGTH
                    );
                  }}
                  onChange={e => {
                    setCurrentKeywords(e.target?.value);
                  }}
                  placeholder={i18n('folder_condition_tip')}
                />
              </td>
            </tr>
            <tr className={'condition-tr condition-tr-two'}>
              <td className={'condition-td1'}>{i18n('groupOwner')}</td>
              <td className={'condition-td2'}>{renderGroupOwners()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  function renderGroupOwners() {
    const { groupOwners } = folderConditions || {};
    const { contact } = props;
    if (!Boolean(groupOwners)) {
      return (
        <div className={'add-owner-btn'} onClick={handleClickAddGroupOwners}>
          <div className={'add-owner-icon'} />
          <div className={'add-owner-text'}>Add</div>
        </div>
      );
    }
    const cIds = groupOwners?.split(',') || [];
    const owners = contact?.filter((c: any) => cIds?.includes(c.id)) || [];
    if (owners.length === 0) {
      return (
        <div className={'add-owner-btn'} onClick={handleClickAddGroupOwners}>
          <div className={'add-owner-icon'} />
          <div className={'add-owner-text'}>Add</div>
        </div>
      );
    }
    return (
      <div style={{ height: '40px' }}>
        {owners?.map((owner: any) => {
          return (
            <div
              key={owner.id}
              className={'owner-item'}
              style={{ display: 'inline-block', paddingLeft: '15px' }}
            >
              <div className={'owner-avatar'}>{renderAvatar(owner, 24)}</div>
              <span className={'owner-name'}>{owner.name}</span>
              <div
                className={'remove-owner'}
                onClick={() => {
                  handleRemoveGroupOwner(owner.id);
                }}
              />
            </div>
          );
        })}
        {owners.length < 5 && (
          <div
            style={{ marginBottom: '5px' }}
            className={'add-owner-btn'}
            onClick={handleClickAddGroupOwners}
          >
            <div className={'add-owner-icon'} />
            <div className={'add-owner-text'}>Add</div>
          </div>
        )}
      </div>
    );
  }

  function renderBody() {
    const { operationType } = props;

    if (operationType === 'detail') {
      return renderDetail();
    }
    return renderAction();
  }

  function handleBack(isSaveOrEdit: boolean) {
    const { operationType } = props;
    if (operationType === 'create' || operationType === 'edit') {
      if (isSaveOrEdit) {
        initCreateData();
        props.changeOperationType('detail');
      } else {
        const now = selectedConversations
          ?.map((c: any) => c.id)
          ?.sort()
          ?.join('');
        const old = beforeFolderCids?.sort()?.join('');
        const orignFolderName = $('#folder-name-input').val() as string;
        const currentName = orignFolderName.trim();
        const keywords = (document.getElementById('folder-keywords') as any)
          .value;

        const oldGroupOwner = beforeFolderConditions?.groupOwners
          ?.split(',')
          ?.sort()
          ?.join('');
        const newGroupOwner = folderConditions?.groupOwners
          ?.split(',')
          ?.sort()
          ?.join('');

        if (
          now === old &&
          currentName === beforeFolderName &&
          Boolean(keywords) === Boolean(beforeFolderConditions?.keywords) &&
          oldGroupOwner === newGroupOwner
        ) {
          initCreateData();
          props.changeOperationType('detail');
        } else {
          if (confirm(props.i18n('update-to-back'))) {
            initCreateData();
            props.changeOperationType('detail');
          }
        }
      }
    } else {
      initCreateData();
      props.changeOperationType('detail');
      props.onClose();
    }
  }

  function handleCreateOrUpdate() {
    if (
      currentFolderName.length === 0 ||
      ((!selectedConversations || selectedConversations.length === 0) &&
        (!currentKeywords || currentKeywords?.length === 0) &&
        (!folderConditions?.groupOwners ||
          folderConditions?.groupOwners.length === 0))
    ) {
      return;
    }
    if (
      (currentKeywords && currentKeywords.length < 2) ||
      currentKeywords.length > 64
    ) {
      return;
    }

    const { i18n, operationType, chatFolders } = props;

    const orignFolderName = $('#folder-name-input').val() as string;
    const inputFolderName = orignFolderName.trim();
    if (!inputFolderName || inputFolderName.length === 0) {
      (window as any).noticeWarning(props.i18n('folder-name-empty-tip'));
      return;
    }
    if (inputFolderName.length > 12) {
      (window as any).noticeWarning('The Folder name max Length 12!');
      return;
    }
    if (RECOMMEND_FOLDER_NAMES.includes(inputFolderName)) {
      if (operationType === 'create') {
        (window as any).noticeWarning(i18n('conflicts_with_recommend'));
        return;
      } else {
        if (
          inputFolderName !== beforeFolderName &&
          RECOMMEND_FOLDER_NAMES.includes(inputFolderName)
        ) {
          (window as any).noticeWarning(i18n('conflicts_with_recommend'));
          return;
        }
      }
    }

    let cIds = [] as any;
    selectedConversations.forEach((c: any) => {
      const item = {
        id:
          c.type === 'group'
            ? (window as any).Signal.ID.convertIdToV2(c.id)
            : c.id,
        type: c.type === 'group' ? 1 : 0,
      };
      cIds.push(item);
    });

    const conditions = {} as any;
    const keywordInput = document.getElementById('folder-keywords') as any;
    if (keywordInput && keywordInput?.value && keywordInput.value.length > 0) {
      conditions.keywords = keywordInput.value;
    }
    conditions.groupOwners = folderConditions?.groupOwners;
    const folder = {
      name: inputFolderName,
      cIds: cIds,
      type: 1,
      conditions,
    };

    if (chatFolders) {
      for (let i = 0; i < chatFolders.length; i++) {
        if (
          operationType === 'edit' &&
          chatFolders[i].name == inputFolderName &&
          inputFolderName !== beforeFolderName
        ) {
          (window as any).noticeWarning(i18n('folder_duplicate_name_tip'));
          return;
        }
        if (
          operationType === 'create' &&
          chatFolders[i].name == inputFolderName
        ) {
          (window as any).noticeWarning(i18n('folder_duplicate_name_tip'));
          return;
        }
      }
    }

    const targetChatFolders = [...chatFolders];

    if (operationType === 'create') {
      targetChatFolders.push(folder);
    }

    let flag = true;
    if (operationType === 'edit') {
      targetChatFolders.forEach((f: any, index: number) => {
        if (f.name === beforeFolderName) {
          targetChatFolders.splice(index, 1);
          targetChatFolders.splice(index, 0, folder);
          flag = false;
        }
      });

      if (flag) {
        targetChatFolders.push(folder);
      }
    }

    handleBack(true);
    preTurn.current = targetChatFolders?.map(f => f.name) || [];
    props.updateOrCreate(targetChatFolders, operationType, inputFolderName);
  }

  function handleClickAddConversation() {
    const inputFolderName = $('#folder-name-input').val() as string;
    const contact = (window as any).getAliveConversationsProps();
    const ev = new CustomEvent('folder-add-conversation', {
      detail: [selectedConversations, contact, inputFolderName],
    });
    window.dispatchEvent(ev);
  }

  function handleClickAddGroupOwners() {
    const privateConversations =
      (window as any).getAlivePrivateConversationsProps() || [];
    const { groupOwners } = folderConditions || {};
    let selectedOwners;
    if (!Boolean(groupOwners)) {
      selectedOwners = [];
    }
    const cids = groupOwners?.split(',') || [];
    selectedOwners =
      privateConversations.filter((c: any) => cids.includes(c.id)) || [];
    const ev = new CustomEvent('folder-condition-add-group-owners', {
      detail: {
        privateConversations,
        selectedOwners,
      },
    });
    window.dispatchEvent(ev);
  }

  function handleRemoveGroupOwner(id: string) {
    const conditions = { ...folderConditions };
    const { groupOwners } = conditions || {};
    if (!groupOwners) {
      return;
    }

    const cids = groupOwners?.split(',') || [];
    if (cids.length === 0) {
      return;
    }

    const index = cids?.indexOf(id);
    cids?.splice(index, 1);

    const newGroupOwners = [...cids]?.join(',');
    conditions['groupOwners'] = newGroupOwners;
    setFolderConditions(conditions);
  }

  function renderAddFolder() {
    const { i18n } = props;
    return (
      <div
        style={{ cursor: 'pointer' }}
        onClick={() => {
          initCreateData();
          props.changeOperationType('create');
        }}
      >
        <div className={'chat-folders-wrapper'}>
          <div className={'chat-folders-add-icon'} />
          <div className={'chat-folders-action-area'}>
            <div className={'add-button'}>{i18n('add_folder')}</div>
          </div>
        </div>
      </div>
    );
  }

  function checkFolderName(id: string, max: number) {
    let elemInput = document.getElementById(id) as any;
    if (shakeTimer) {
      clearTimeout(shakeTimer);
      elemInput.classList.remove('shake');
    }
    const txt = ($('#' + id).val() as string).trim();

    if (txt.length > max) {
      const name = txt.slice(0, max) || '';
      $('#' + id).val(name);
      elemInput.classList.add('shake');
      const newTimer = setTimeout(() => {
        elemInput.classList.remove('shake');
      }, 800) as any;
      setShakeTimer(newTimer);
    } else {
      $('#' + id).val(txt);
    }
  }

  function checkConditionKeywords(id: string, max: number) {
    const txt = ($('#' + id).val() as string).trim();
    if (txt.length > max) {
      const name = txt.slice(0, max) || '';
      $('#' + id).val(name);
    } else {
      $('#' + id).val(txt);
    }
  }

  function renderFolderNameInput() {
    const { i18n } = props;
    return (
      <div className={'chat-folders-wrapper'}>
        <div style={{ height: '37px', width: '100%' }}>
          <div className={'chat-folders-action-area'}>
            <input
              className={'input-box'}
              id={'folder-name-input'}
              onKeyUp={() => {
                checkFolderName('folder-name-input', MAX_FOLDER_NAME_LENGTH);
              }}
              onKeyDown={() => {
                checkFolderName('folder-name-input', MAX_FOLDER_NAME_LENGTH);
              }}
              onChange={e => {
                setCurrentFolderName(e.target?.value?.trim());
              }}
              type="text"
              placeholder={i18n('foler_name_placeholder')}
              defaultValue={beforeFolderName}
            />
          </div>
          <div className={'folder-name-count'}>{}</div>
          <div className={'chat-folders-folder-icon'} />
        </div>
      </div>
    );
  }

  function renderFolderAddConversation() {
    const { i18n } = props;
    return (
      <div style={{ cursor: 'pointer' }} onClick={handleClickAddConversation}>
        <div className={'chat-folders-wrapper'}>
          <div className={'chat-folders-add-icon'} />
          <div className={'chat-folders-action-area'}>
            <div className={'add-button'}>{i18n('add_chats')}</div>
          </div>
        </div>
      </div>
    );
  }

  function removeConversation(c: any) {
    const newSelected = _.difference(selectedConversations, [c]);
    setSelectedConversations([...newSelected]);
  }

  function removeFolder(folderName: any) {
    if (!folderName || folderName.length === 0) {
      (window as any).noticeError('Folder is not available！');
      return;
    }
    const { chatFolders } = props;
    const newChatFolders = [...chatFolders];
    chatFolders.forEach((item, index) => {
      if (item.name === folderName) {
        newChatFolders.splice(index, 1);
      }
    });
    preTurn.current = newChatFolders.map(f => {
      return f.name;
    });
    props.updateOrCreate([...newChatFolders], 'delete');
  }

  function renderConversationList() {
    const { i18n } = props;
    return (
      <div className={'conversation-list'}>
        <ul className={'conversation-ul'}>
          {selectedConversations.map((item: any) => {
            const isOutside = (window as any).ConversationController.get(
              item.id
            )?.isOutside();
            return (
              <li id={item.id} key={item.id} className={'conversation-li-item'}>
                <div
                  className={'conversation-remove-icon'}
                  onClick={() => {
                    removeConversation(item);
                  }}
                />
                <div className={'conversation-avatar'}>
                  {renderAvatar(item)}
                </div>
                <div className={'conversation-name'}>{item.name}</div>
                {isOutside && (
                  <div
                    style={{
                      display: 'inline-block',
                      height: '21px',
                      marginLeft: '5px',
                    }}
                  >
                    <Tag i18n={i18n} tagName={'external'} showTips />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  function handleFolderClick(event: any) {
    if (event && event.button === 2) {
      const li = event.target as HTMLLIElement;
      const id = li.getAttribute('id') || '';
      if (!id || id === 'click-to-edit-folder') {
        return;
      }
      const box = document.querySelector('.chat-folders') as any;

      let y = event.pageY - box.offsetTop;
      let x = event.pageX - box.offsetLeft;

      const width = window.innerWidth;

      if (event.pageX + 110 >= width) {
        x -= 100;
      }
      $('.folder-operation-menu')
        .css('left', x)
        .css('top', y)
        .css('display', 'block');
    }
  }

  function renderDragFolderList() {
    const { chatFolders, i18n } = props;
    if (!chatFolders || chatFolders.length === 0) {
      return;
    }
    return (
      <div className={'folder-list'}>
        <span style={{ fontSize: '13px', color: 'grey' }}>
          {i18n('folder_drag_tip')}
        </span>
        <span className={'folder-delete-tip'} style={{ fontSize: '13px' }}>
          {i18n('folder_delete_tip')}
        </span>
        <ul className="folder-drag-ul">
          {chatFolders.map(item => {
            let num = 0;
            let privateConversationCount = 0;
            let unreadConversationCount = 0;
            let atMeConversationCount = 0;
            const { activeConversations, ourNumber } = props || {};
            if (item.type === 0) {
              if (activeConversations && activeConversations.length > 0) {
                activeConversations.forEach((c: any) => {
                  if (c?.unreadCount > 0) {
                    unreadConversationCount += 1;
                  }
                  if (c?.type !== 'group') {
                    privateConversationCount += 1;
                  }
                  if (
                    (c?.atPersons?.includes(ourNumber) ||
                      c?.atPersons?.includes('MENTIONS_ALL')) &&
                    c?.unreadCount > 0
                  ) {
                    atMeConversationCount += 1;
                  }
                });
              }
            } else {
              const groupOwnersIds =
                (item?.conditions?.groupOwners || '').split(',') || [];
              const keywords = (
                item?.conditions?.keywords || ''
              ).toLocaleLowerCase();
              const cIds =
                item?.cIds?.map((c: any) =>
                  (window as any).Signal.ID.convertIdToV1(c.id)
                ) || [];
              const filterIds =
                activeConversations
                  ?.filter((c: any) => {
                    const groupOwnerId = (
                      window as any
                    ).ConversationController.get(c.id)?.getGroupOwnerId();
                    const groupOwnersCondition = Boolean(
                      groupOwnersIds.length > 0 &&
                        groupOwnerId &&
                        groupOwnersIds.includes(groupOwnerId)
                    );
                    return (
                      cIds?.includes(c.id) ||
                      (keywords &&
                        keywords.length > 0 &&
                        c.name?.toLocaleLowerCase()?.includes(keywords)) ||
                      groupOwnersCondition
                    );
                  })
                  ?.map((c: any) => c.id) || [];
              const all = [...cIds, ...filterIds];
              num = Array.from(new Set(all)).length;
            }

            return (
              <li
                id={item.name + 'drag'}
                key={item.name}
                draggable={true}
                className="folder-drag-li-item"
                style={{ cursor: 'pointer' }}
                onMouseDown={handleFolderClick}
                onClick={() => {
                  if (item.type === 0) {
                    return;
                  }
                  props.handleClickToEdit(item.name);
                }}
              >
                <div className={'folder-icon'} />
                <div className={'folder-name'}>
                  {item.type === 0 ? props.i18n(item.name) : item.name}
                </div>
                {item.type !== 0 && (
                  <div
                    id={'click-to-edit-folder'}
                    className={'operation-icon'}
                  />
                )}
                {item.type !== 0 && (
                  <div className={'conversation-count'}>{num}</div>
                )}
                {item.type === 0 && item.name === 'Private' && (
                  <div className={'conversation-count-recommend'}>
                    {privateConversationCount}
                  </div>
                )}
                {item.type === 0 && item.name === 'Unread' && (
                  <div className={'conversation-count-recommend'}>
                    {unreadConversationCount}
                  </div>
                )}
                {item.type === 0 && item.name === '@Me' && (
                  <div className={'conversation-count-recommend'}>
                    {atMeConversationCount}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  function renderAvatar(
    conversation: ConversationListItemPropsType,
    size?: number
  ) {
    const { i18n } = props;
    return (
      <Avatar
        conversationType={conversation.type}
        i18n={i18n}
        size={size || 36}
        {...conversation}
      />
    );
  }

  function getBothNames(signalNames: any) {
    const result = [] as any;
    signalNames.forEach((n: string) => {
      if (n === 'Private' || n === '私聊') {
        result.push('Private');
        result.push('私聊');
      } else if (n === '@Me' || n === '@我') {
        result.push('@Me');
        result.push('@我');
      } else if (n === 'Unread' || n === '未读') {
        result.push('Unread');
        result.push('未读');
      } else {
        result.push(n);
      }
    });
    return result;
  }

  function handleRecommend(name: string) {
    const { chatFolders, updateOrCreate, i18n } = props;
    const signalNames = chatFolders.map(f => f.name) || [];
    const bothNames = getBothNames(signalNames);
    if (bothNames.includes(name)) {
      (window as any).noticeError(i18n('recommend_duplicate_name_tip'));
      return;
    }
    // 把当前点击的folder 添加到列表第一个
    const result = [...chatFolders];
    result.unshift({
      name,
      cIds: [],
      type: 0,
    });
    updateOrCreate(result, 'create', name, true);
  }

  function renderRecommendFolderList() {
    return (
      <div className={'recommend-box'}>
        <div className={'recommend-title'}>
          {props.i18n('recommend_folders')}
        </div>
        {recommendFolderList && recommendFolderList.length > 0 && (
          <div className={'recommend-list-box'}>
            {recommendFolderList.map((f: ChatFolderType) => {
              return (
                <div
                  key={f.name + 'recommend'}
                  className={'recommend-item-box'}
                  onClick={() => {
                    handleRecommend(f.name);
                  }}
                >
                  <div className={'add-btn-box'}>
                    <div className={'add-btn'} />
                  </div>
                  <div className={'recommend-item'}>{props.i18n(f.name)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id={'chat-folders'} className={'chat-folders'}>
      <div className={'folder-operation-menu'}>
        <div
          className={'menu-item'}
          onClick={() => {
            if (preCheckFolder.current === 'folder-condition-keywords') {
              // 这边是 remove folder keywords condition
              setFolderConditions({ keywords: '' });
              return;
            }
            const folder =
              props.chatFolders?.find(
                f => f.name === preCheckFolder.current.slice(0, -4)
              ) || ({} as any);
            const tip =
              folder?.type === 0
                ? props.i18n('delete-recommend-folder-confirm-tip')
                : props.i18n('delete-folder-confirm-tip');
            if (confirm(tip)) {
              removeFolder(preCheckFolder.current.slice(0, -4));
            }
            // confirm 过后不管同意与否都隐藏删除菜单
            $('.folder-operation-menu').css('display', 'none');
          }}
        >
          <div className={'delete-icon'} />
          <div className={'operation'}>
            {props.operationType === 'detail'
              ? currentEditFolder?.type === 0
                ? props.i18n('remove-folder')
                : props.i18n('delete-folder')
              : props.i18n('remove-folder')}
          </div>
        </div>
      </div>
      {renderHeader()}
      {renderBody()}
    </div>
  );
}
