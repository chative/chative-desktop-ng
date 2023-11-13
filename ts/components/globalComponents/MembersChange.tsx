import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { AutoSizer, List } from 'react-virtualized';
import { LocalizerType } from '../../types/Util';
import { ContactListItem } from '../ContactListItem';
import Dialog from '../Dialog';

export interface PropsType {
  i18n: LocalizerType;
  onClose: () => void;
  onConfirm: (members: Array<string>, options: any) => void;
  type: string;

  items: Array<any>;
  disabledItems?: Array<any>;
  groupName?: string;
  memberRapidRole: any;
  loading: boolean;
}

export default function MembersChange(props: PropsType) {
  const { i18n, onClose, disabledItems } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState('');
  const [currentItems, setCurrentItems] = useState(props.items);
  const [rightItems, setRightItems] = useState<Array<any>>([]);
  const maxGroupNameLength = 64;

  let defaultName = '';
  if (props.type === 'new-group') {
    defaultName = i18n('new_group');
  }
  if (props.type === 'rapid-group') {
    defaultName = 'Rapid group';
    if (props.disabledItems && props.disabledItems.length === 2) {
      for (let i = 0; i < props.items.length; i++) {
        if (props.items[i].id === props.disabledItems[0]) {
          defaultName = props.items[i].name + ', ';
        }
        if (props.items[i].id === props.disabledItems[1]) {
          defaultName += props.items[i].name;
          break;
        }
      }
    }
  }
  if (props.type === 'group-rapid-group') {
    const existsGroupName = props.groupName || '';
    defaultName = i18n('group_editor_title_template_for_rapid_group', [
      existsGroupName,
    ]);

    const nameLen = defaultName.length;
    if (nameLen > 64) {
      const keptLen = 2 * existsGroupName.length - nameLen;
      defaultName = i18n('group_editor_title_template_for_rapid_group', [
        existsGroupName.substring(0, keptLen - 3) + '...',
      ]);
    }
  }
  if (props.type === 'instant-meeting') {
    defaultName = 'Instant meeting';
    if (props.disabledItems && props.disabledItems.length) {
      for (let i = 0; i < props.items.length; i++) {
        if (props.items[i].id === props.disabledItems[0]) {
          defaultName = `${props.items[i].name} Meeting`;
          break;
        }
      }
    }
  }

  const [groupName, setGroupName] = useState(defaultName);

  useEffect(() => {
    const { items } = props;
    const conversations: any = [];
    for (let i = 0; i < items.length; i += 1) {
      if (isSearchMatch(items[i], searchText)) {
        conversations.push(items[i]);
      }
    }
    setCurrentItems(conversations);
  }, [searchText]);

  const setInputFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const inputTextChanged = (event: React.FormEvent<HTMLInputElement>) => {
    setSearchText(event.currentTarget.value || '');
  };

  const isSearchMatch = (c: any, searchTerm: string) => {
    const search = searchTerm.toLowerCase();
    let name = c.id;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.name;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.profileName;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.title;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.email;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.signature;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    // for self
    if (c.isMe) {
      name = i18n('noteToSelf');
      if (name.toLowerCase().includes(search)) {
        return true;
      }
    }

    return false;
  };

  const renderLeftRow = ({ index, style }: any): JSX.Element => {
    const conversation = currentItems[index];
    const checkboxStatus = disabledItems?.includes(conversation.id);
    const { memberRapidRole } = props;
    const rapidRole =
      memberRapidRole && conversation
        ? memberRapidRole?.[conversation.id]
        : undefined;
    const isOutside = (window as any).ConversationController.get(
      conversation.id
    )?.isOutside(conversation?.extId);
    return (
      <ContactListItem
        i18n={i18n}
        key={conversation.id}
        {...conversation}
        verified={false}
        style={style}
        onClick={() => {
          if (checkboxStatus) {
            return;
          }

          if (
            props.type === 'instant-meeting' ||
            props.type === 'meeting-add'
          ) {
            const gl = (window as any).getGlobalConfig();
            let forbidArray = ['609066'];
            if (
              gl &&
              gl.meeting &&
              Array.isArray(gl.meeting.meetingInviteForbid)
            ) {
              forbidArray = gl.meeting.meetingInviteForbid;
            }
            for (let i = 0; i < forbidArray.length; i += 1) {
              if (conversation.id.endsWith(forbidArray[i])) {
                alert('You are not authorized to invite this user.');
                return;
              }
            }
          }

          if (rightItems.includes(conversation.id)) {
            // tslint:disable-next-line:prefer-for-of
            for (let i = 0; i < rightItems.length; i += 1) {
              if (rightItems[i] === conversation.id) {
                rightItems.splice(i, 1);
                break;
              }
            }
            setRightItems([...rightItems]);
          } else {
            setRightItems([...rightItems, conversation.id]);
          }
          if (inputRef.current?.value) {
            inputRef.current.value = '';
            setSearchText('');
            setTimeout(() => {
              setInputFocus();
            }, 0);
          }
        }}
        withCheckbox={true}
        checkboxChecked={checkboxStatus || rightItems.includes(conversation.id)}
        disableCheckbox={checkboxStatus}
        rapidRole={rapidRole}
        isOutside={isOutside}
      />
    );
  };

  const renderRightRow = ({ index, style }: any): JSX.Element => {
    const { items, memberRapidRole } = props;
    const id = rightItems[index];
    let conversation: any;
    for (let i = 0; i < items.length; i += 1) {
      if (id === items[i].id) {
        conversation = items[i];
        break;
      }
    }
    if (!conversation) {
      throw Error('Bad right items.');
    }
    const rapidRole =
      memberRapidRole && conversation
        ? memberRapidRole?.[conversation.id]
        : undefined;
    const isOutside = (window as any).ConversationController.get(
      conversation.id
    )?.isOutside(conversation?.extId);
    return (
      <ContactListItem
        i18n={i18n}
        key={conversation.id}
        {...conversation}
        verified={false}
        style={style}
        onClick={() => {
          for (let i = 0; i < rightItems.length; i += 1) {
            if (rightItems[i] === conversation.id) {
              rightItems.splice(i, 1);
              break;
            }
          }
          setRightItems([...rightItems]);
        }}
        rapidRole={rapidRole}
        isOutside={isOutside}
      />
    );
  };

  const renderLeftList = () => {
    return (
      <div
        className={classNames('module-left-pane__list', 'scroll-background')}
        key={0}
        style={{ height: '392px' }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              className={'module-left-pane__virtual-list overflow-style-normal'}
              conversations={currentItems}
              height={height}
              rowCount={currentItems.length}
              rowHeight={56}
              rowRenderer={renderLeftRow}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  };

  const renderRightList = () => {
    return (
      <div
        className={classNames('module-left-pane__list', 'scroll-background')}
        key={1}
        style={{ height: '440px' }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              className={'module-left-pane__virtual-list overflow-style-normal'}
              conversations={rightItems}
              height={height}
              rowCount={rightItems.length}
              rowHeight={56}
              rowRenderer={renderRightRow}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  };

  const renderInput = () => {
    if (!defaultName) {
      return null;
    }

    return (
      <div className={'name-container'}>
        <span>{i18n('name')}</span>
        <input
          defaultValue={defaultName}
          maxLength={maxGroupNameLength}
          onChange={event => {
            let text = event.target.value?.trim();
            if (text && text.length > maxGroupNameLength) {
              text = text.substr(0, maxGroupNameLength);
            }
            setGroupName(text);
          }}
        />
      </div>
    );
  };

  const renderMiddle = () => {
    return (
      <div
        className={classNames('border-lightgray')}
        style={{ width: '603px', height: '442px', borderRadius: '4px' }}
      >
        <div
          className={classNames('borderRight-lightgray')}
          style={{
            width: '300px',
            height: '440px',
            float: 'left',
          }}
        >
          <div
            className="module-main-header__search"
            style={{ margin: '10px' }}
          >
            <div
              role="button"
              className="module-main-header__search__icon"
              onClick={setInputFocus}
            />
            <input
              type="text"
              ref={inputRef}
              className="module-main-header__search__input"
              style={{ width: '280px' }}
              placeholder={i18n('search')}
              dir="auto"
              onChange={inputTextChanged}
            />
            {searchText ? (
              <div
                role="button"
                className="module-main-header__search__cancel-icon"
                onClick={() => {
                  setSearchText('');
                  if (inputRef.current) {
                    inputRef.current.value = '';
                  }
                }}
              />
            ) : null}
          </div>
          {currentItems && currentItems.length ? (
            renderLeftList()
          ) : (
            <div style={{ textAlign: 'center', marginTop: '5px' }}>
              {i18n('noSearchResults', [searchText])}
            </div>
          )}
        </div>
        <div
          style={{ width: '300px', height: '440px', display: 'inline-block' }}
        >
          {renderRightList()}
        </div>
      </div>
    );
  };

  const renderImportButton = () => {
    if (props.type !== 'new-group' && props.type !== 'add-group-members') {
      return null;
    }
    return (
      <>
        <button
          onClick={() => {
            if (importInputRef.current) {
              importInputRef.current.click();
            }
          }}
        >
          {i18n('group_editor_import')}
        </button>
        <input
          ref={importInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".csv"
          onChange={async () => {
            if (!importInputRef.current) {
              return;
            }

            const imported: any = [];
            const files = importInputRef.current.files;
            if (!files) {
              return;
            }
            for (let index = 0; index < files.length; index += 1) {
              const file = files[index];
              const parser = (window as any).fs
                .createReadStream(file.path)
                .pipe(
                  (window as any).csv_parse({
                    bom: true,
                    delimiter: [',', ';'],
                    trim: true,
                    relax_column_count: true,
                    skip_empty_lines: true,
                    skip_records_with_empty_values: true,
                  })
                );

              for await (const record of parser) {
                record.forEach((email: string) => {
                  if (!email) {
                    return;
                  }
                  for (let i = 0; i < props.items.length; i++) {
                    const item = props.items[i];
                    if (item.email) {
                      if (
                        email.toLowerCase() === item.email.toLowerCase() &&
                        !rightItems.includes(item.id)
                      ) {
                        if (!disabledItems?.includes(item.id)) {
                          imported.push(item.id);
                        }
                      }
                    }
                  }
                });
              }
            }

            if (imported.length) {
              setRightItems([...rightItems, ...imported]);
            }
            setTimeout(
              () => alert(i18n('importUsers', [imported.length + ''])),
              50
            );
            importInputRef.current.value = '';
          }}
        />
      </>
    );
  };

  let okButtonDisabled = rightItems.length === 0;
  let title;
  if (props.type === 'new-group' || props.type === 'rapid-group') {
    title = i18n('group_editor_create_new_group');
  }
  if (props.type === 'group-rapid-group') {
    title = i18n('group_editor_dialog_title_for_rapid_group');
    okButtonDisabled = false;
  }
  if (props.type === 'instant-meeting') {
    title = i18n('group_editor_add_instant_meeting');
  }
  if (props.type === 'add-group-members') {
    title = i18n('group_editor_add_group_members_title');
  }
  if (props.type === 'remove-group-members') {
    title = i18n('group_editor_remove_group_members');
  }
  if (props.type === 'add-group-admins') {
    title = i18n('group_editor_add_group_moderator');
  }
  if (props.type === 'remove-group-admins') {
    title = i18n('group_editor_remove_group_moderator');
  }
  if (props.type === 'meeting-add') {
    title = i18n('group_editor_add_meeting_members');
  }

  const renderFullLoading = () => {
    if (!props.loading) {
      return null;
    }

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 200,
        }}
      >
        <div style={{ width: '100%', height: '100%' }}>
          <div className={'waiting-border'}>
            <div
              className="waiting"
              style={{ width: 40, height: 40, margin: 10 }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog onClose={onClose} escClose={!props.loading}>
      <div className="settings-members-change-dialog">
        <h3>{title}</h3>
        {renderInput()}
        {renderMiddle()}
        <div style={{ textAlign: 'right' }}>
          {renderImportButton()}
          <button onClick={onClose}>{i18n('cancel')}</button>
          <button
            disabled={okButtonDisabled}
            style={{
              cursor: !okButtonDisabled ? 'pointer' : 'not-allowed',
              color: 'white',
              border: 'none',
              backgroundColor: !okButtonDisabled
                ? 'rgb(32, 144, 234)'
                : 'rgb(97 167 224)',
            }}
            onClick={() => {
              props.onConfirm(rightItems, { groupName });
            }}
          >
            {i18n('confirmNumber', ['' + (rightItems.length || '')])}
          </button>
        </div>
        {renderFullLoading()}
      </div>
    </Dialog>
  );
}
