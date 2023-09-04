import { Modal, Button, Input, Form } from 'antd';
import React, { useState } from 'react';

type Props = {
  doLogin: (email: string, okta: string, oktaPrefix: string) => void;
  getOpenIdLoginAddress: (domain: string) => void;
};

export const Register = (props: Props) => {
  const { doLogin, getOpenIdLoginAddress } = props;
  const [form] = Form.useForm();
  const [oktaValue] = useState('');
  const [Register] = useState('Register');
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showOktaInput, setShowOktaInput] = useState(false);
  // const [error,setError] = useState('');
  const [oktaPrefixValue, setOktaPrefixValue] = useState('');
  // const [showLoading,setShowLoading] = useState(false);
  // const [disable,setDisable] = useState(false);
  const handleCancel = () => {
    setVisible(false);
  };

  const check = async () => {
    let value = await form.getFieldsValue();
    const emailValue = value.InputValue;
    const mailExp =
      /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/;
    if (emailValue && mailExp.test(emailValue)) {
      let loginInfo = (window as any).textsecure.storage.get('loginInfo');
      if (loginInfo != undefined) {
        const { email, domainPrefix } = loginInfo;
        if (emailValue === email) {
          setShowOktaInput(false); // 这里是在第二个页面如果更改为之前登录过的email地址，为了使okta前缀框显示所做的操作
          form.setFieldsValue({
            oktaPrefix: domainPrefix,
          });
        } else {
          setShowOktaInput(false);
          form.setFieldsValue({ oktaPrefix: '' });
        }
        setShowOktaInput(true);
      }
      setShowOktaInput(true);
    } else {
      setShowOktaInput(false);
      form.setFieldsValue({ oktaPrefix: '' });
    }
  };
  const handleOk = async () => {
    let values = await form.getFieldsValue();
    let loginInfo = (window as any).textsecure.storage.get('loginInfo');

    if (loginInfo != undefined) {
      const { email, domainPrefix } = loginInfo;
      if (values.InputValue === email && values.oktaPrefix === undefined) {
        values.oktaPrefix = domainPrefix;
      }
    }
    const RegExp = /@/;
    const inviteExp = /[a-zA-Z0-9]{32}/; // 32邀请码
    // 验证邮箱规则
    const mailExp =
      /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/;
    const oktaPrefixExp = /^[a-zA-Z0-9][-a-zA-Z0-9]{0,62}$/; //验证okta前缀规则
    // 第一个页面不输入邮箱点击登录，验证提示错误信息
    if (values.InputValue === undefined) {
      form.validateFields();
    }

    // && mailExp.test(values.InputValue)
    // 第一个页面输入邮箱验证通过后，点击登录，弹出okta框
    if (
      RegExp.test(values.InputValue) &&
      values.oktaPrefix === undefined &&
      mailExp.test(values.InputValue)
    ) {
      form.validateFields();
      setShowOktaInput(true);
    }
    // okta
    if (
      RegExp.test(values.InputValue) &&
      values.oktaPrefix &&
      mailExp.test(values.InputValue) &&
      oktaPrefixExp.test(values.oktaPrefix)
    ) {
      const okta = values.oktaPrefix + oktaSuffix;
      try {
        await getOpenIdLoginAddress(okta);
        doLogin(values.InputValue, okta, values.oktaPrefix);
        setLoading(true);
        setVisible(false);
      } catch (error) {
        const HTTPErrorRegExp = /-1/;
        // @ts-ignore
        if (!HTTPErrorRegExp.test(error.message)) {
          setOktaPrefixValue(values.oktaPrefix);
          // setShowLoading(false);
          form.validateFields();
        } else {
          alert('Network exception');
          // setShowLoading(false);
        }
      }
      // doLogin(values.InputValue, okta, values.oktaPrefix);
      // setLoading(true);
      // setVisible(false);
    }
    // 32位邀请码
    if (
      !RegExp.test(values.InputValue) &&
      values.InputValue.length === 32 &&
      inviteExp.test(values.InputValue)
    ) {
      doLogin(values.InputValue, '', '');
      setLoading(true);
      setVisible(false);
    }
    // 17位验证码
    if (!RegExp.test(values.InputValue) && values.InputValue.length === 17) {
      doLogin(values.InputValue, '', '');
      setLoading(true);
      setVisible(false);
    }
  };

  const oktaSuffix = '.okta.com';
  return (
    <Modal
      open={visible}
      title={Register}
      onOk={handleOk}
      onCancel={handleCancel}
      mask={false}
      centered={true}
      maskClosable={false}
      style={{ top: 100 }}
      footer={null}
    >
      <Form form={form} name="dynamic_rule" onFinish={handleOk}>
        <Form.Item
          name="InputValue"
          rules={[
            {
              validator: (_, value, callback) => {
                const mailExp =
                  /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/;
                const inviteExp = /[a-zA-Z0-9]{32}/;
                const vCodeExp = /\d{17}/;
                if (value == '' || value === undefined) {
                  callback('Please enter your Email or Code');
                }
                if (
                  !mailExp.test(value) &&
                  !inviteExp.test(value) &&
                  !vCodeExp.test(value) &&
                  value != ''
                ) {
                  callback('Please enter the correct email address or Code');
                }
              },
            },
          ]}
        >
          <Input
            placeholder="Enter your Email or Code"
            size={'large'}
            allowClear
            onBlur={check}
          />
        </Form.Item>

        {showOktaInput ? (
          <Form.Item
            name="oktaPrefix"
            rules={[
              {
                validator: (_, value, callback) => {
                  const oktaPrefixExp = /^[a-zA-Z0-9][-a-zA-Z0-9]{0,62}$/;
                  if (value == '' || value === undefined) {
                    callback('Please enter the prefix of okta');
                  }
                  if (
                    (!oktaPrefixExp.test(value) && value != '') ||
                    value === oktaPrefixValue
                  ) {
                    callback('Please enter the correct prefix');
                  }
                },
              },
            ]}
          >
            <Input
              placeholder="Enter the prefix of okta"
              size={'large'}
              allowClear
              addonAfter={oktaSuffix}
              value={oktaValue}
              // onFocus={removeError}
            />
          </Form.Item>
        ) : null}
        {/*{(showOktaInput && error != '') ?<span className={'danger'}>{error}</span> :null}*/}
        <br />
        <Form.Item>
          <Button
            type="primary"
            htmlType="button"
            onClick={handleOk}
            loading={loading}
            block={true}
            size={'large'}
          >
            Login
            {/*{showLoading ? <Spin/> : null}*/}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};
