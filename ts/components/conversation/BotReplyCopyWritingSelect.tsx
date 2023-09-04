import React from 'react';
import { LocalizerType } from '../../types/Util';
import { AutoSizer, List } from 'react-virtualized';
import { BotReplyListItem } from './BotReplyListItem';

type PropsType = {
  i18n: LocalizerType;
  result: Array<any>;
  onClose: () => void;
  doSelect: (c: any) => void;
};

type StateType = {
  selectedIndex: number;
};

export class BotReplyCopyWritingSelect extends React.Component<
  PropsType,
  StateType
> {
  public wrapperRef: React.RefObject<HTMLDivElement>;
  public inputRef: React.RefObject<HTMLInputElement>;
  public listRef: React.RefObject<List>;

  constructor(props: PropsType) {
    super(props);

    this.wrapperRef = React.createRef();
    this.inputRef = React.createRef();
    this.listRef = React.createRef();
    this.handleClickOutside = this.handleClickOutside.bind(this);

    this.state = { selectedIndex: props.result.length > 1 ? 1 : 0 };
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside);
    document.addEventListener('keydown', this.handleKeyBoardEvent);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
    document.removeEventListener('keydown', this.handleKeyBoardEvent);
  }

  componentDidUpdate(prevProps: Readonly<PropsType>) {
    const { result } = this.props;
    const prevContacts = prevProps.result;
    if (result.length !== prevContacts.length) {
      this.setState({ selectedIndex: result.length > 1 ? 1 : 0 });
    }
  }

  handleClickOutside(event: MouseEvent) {
    if (
      event &&
      this.wrapperRef?.current &&
      !this.wrapperRef.current.contains(event.target as Node)
    ) {
      this.props?.onClose();
    }
  }

  public handleKeyBoardEvent = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.props?.onClose();
      return;
    }

    if (event.key === 'ArrowUp') {
      const x = this.state.selectedIndex - 1;
      if (x < 0) {
        this.setState({ selectedIndex: this.props.result.length - 1 });
      } else {
        this.setState({ selectedIndex: x });
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      const x = this.state.selectedIndex + 1;
      if (x >= this.props.result.length) {
        this.setState({ selectedIndex: 0 });
      } else {
        this.setState({ selectedIndex: x });
      }
      return;
    }

    if (event.key === 'Enter') {
      // const x = this.state.selectedIndex;
      // const user = this.props.result[x];
      // this.props.doSelect();
    }
  };

  public renderRow = ({ index, style }: any): JSX.Element => {
    const { i18n, /* doSelectTxt,*/ /*doSelectImg,*/ result, doSelect } =
      this.props;
    const { selectedIndex } = this.state;

    const c = result[index];

    return (
      <BotReplyListItem
        key={index}
        txt={c.txt}
        img={c.img}
        // id={c.id}
        style={style}
        i18n={i18n}
        onClick={() => {
          // 黑魔法临时解决问题（问题：点击item框消失的BUG）
          setTimeout(() => {
            doSelect(c);
          }, 0);
        }}
        isSelected={index === selectedIndex}
      />
    );
  };

  public render() {
    const { result } = this.props;

    // const { filterMembers } = this.state;

    // https://stackoverflow.com/questions/41122140/how-to-scroll-to-index-in-infinite-list-with-react-virtualized
    return (
      <>
        {result.length > 0 ? (
          <div
            ref={this.wrapperRef}
            className={'at-person-choose'}
            style={{
              position: 'absolute',
              width: 500,
              maxHeight: 200,
              height: 48 * result.length + 2,
              bottom: 0,
              border: '1px solid darkgray',
            }}
          >
            <div style={{ width: '500px', height: '100%', float: 'left' }}>
              <div style={{ height: '100%', overflow: 'auto' }}>
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      ref={this.listRef}
                      className="module-left-pane__virtual-list width-238px"
                      height={height}
                      rowCount={result.length}
                      rowRenderer={this.renderRow}
                      rowHeight={48}
                      width={width}
                      rerenderWhenChanged={result}
                      scrollToIndex={this.state.selectedIndex}
                    />
                  )}
                </AutoSizer>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }
}
