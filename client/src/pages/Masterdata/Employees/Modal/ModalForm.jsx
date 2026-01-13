// src/pages/Masterdata/Employees/Modal/ModalForm.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Form,
  Input,
  Select,
  AutoComplete,
  Checkbox,
  InputNumber,
  App,
  Button,
  Typography,
  Divider,
  Row,
  Col,
  Upload,
  Tabs,
} from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import buddhistEra from 'dayjs/plugin/buddhistEra';

// --- Internal Components & API ---
import Modallocation from './Modallocation';
import TabWorkhistory from './components/TabWorkhistory';
import TabRelatives from './components/TabRelatives';
import ModalEmployeeWorkReport from './ModalEmployeeWorkReport';

// ✅ เรียกใช้ไฟล์รวม Modal ใหม่ (ทั้ง WorkHistory และ Relatives)
import ModalRelativesForm from './ModalRelativesForm';
import ModalWorkHistoryForm from './ModalWorkHistoryForm'; // ไฟล์ที่เราเพิ่งรวม

import api from '../../../../api';
import { ThaiDateInput } from '../../../../components/form/ThaiDateInput';

// ... (Import Utils และ Config เดิมทั้งหมดคงเดิม) ...
import {
  onlyDigits,
  onlyAlnum,
  isDigits,
  isAlnumRange,
  digitsRule,
  alnumRule,
} from '../../../../utils/form/inputHelpers';
import { calculateAgeThai } from '../../../../utils/date/birthdateHelpers';

import StatusIcon from '../../../../components/common/StatusIcon';

const { Title, Text } = Typography;
dayjs.extend(buddhistEra);
dayjs.locale('th');
const S = Select;
const selProps = {
  allowClear: true,
  showSearch: true,
  optionFilterProp: 'label',
  size: 'small',
  listHeight: 320,
  virtual: false,
  dropdownStyle: { maxHeight: 320, overflowY: 'auto' },
  getPopupContainer: (trigger) => trigger.parentNode,
};
const compactStyle = { marginBottom: 10 };
const fullLayout = {
  labelCol: { xs: 24, sm: 8, md: 6, lg: 5 },
  wrapperCol: { xs: 24, sm: 16, md: 18, lg: 19 },
};
const fullColLayout = {
  labelCol: { xs: 24, sm: 8, md: 6, lg: 5 },
  wrapperCol: { xs: 24, sm: 16, md: 18, lg: 19 },
};
const chkLayout = {
  wrapperCol: {
    xs: 24,
    sm: { offset: 8, span: 16 },
    md: { offset: 6, span: 18 },
    lg: { offset: 5, span: 19 },
  },
};

const publicUrl = (p) => {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const base = api?.defaults?.baseURL || '';
  const m = base.match(/^https?:\/\/[^/]+/i);
  const origin = m ? m[0] : typeof window !== 'undefined' ? window.location.origin : '';
  return origin + p;
};

export default function ModalForm({
  open = true,
  onClose = () => { },
  onSuccess,
  employee,
}) {
  const { message } = App.useApp?.() || { message: { success: console.log, error: console.error } };
  const [form] = Form.useForm();

  const isEdit = !!employee?.employee_id;

  // State Management
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState({ /* ... options defaults ... */ });
  // State สำหรับเช็คว่ามีการเลือกสถานะการทำงานหรือยัง
  const [workStatusTouched, setWorkStatusTouched] = useState(false);

  const [lastCode, setLastCode] = useState(null);
  const [originalCode, setOriginalCode] = useState('');
  const [codeStatus, setCodeStatus] = useState({ status: '', help: '' });
  const [codeDup, setCodeDup] = useState(false);
  const [typingTimer, setTypingTimer] = useState(null);
  const [calculatedAgeString, setCalculatedAgeString] = useState('');
  const [canShowPermissionStatus, setCanShowPermissionStatus] = useState(true);
  const [activeTabKey, setActiveTabKey] = useState('1');
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationTarget, setLocationTarget] = useState(null);
  const [empImgFile, setEmpImgFile] = useState(null);
  const [empImgPreview, setEmpImgPreview] = useState(null);

  // Sub-Modals Data
  const [workHistory, setWorkHistory] = useState({ rows: [], loading: false });
  const [relatives, setRelatives] = useState({ rows: [], loading: false });

  // ✅ State สำหรับ WorkHistory (ใช้ตัวเดียว: เปิด/ปิด และ เก็บ record ปัจจุบัน)
  const [whFormOpen, setWhFormOpen] = useState(false);
  const [currentWh, setCurrentWh] = useState(null); // null=เพิ่ม, object=แก้ไข

  // ✅ State สำหรับ Relatives
  const [relativesFormOpen, setRelativesFormOpen] = useState(false);
  const [currentRelative, setCurrentRelative] = useState(null); // null=เพิ่ม, object=แก้ไข

  // ... (Watchers & Validators - คงเดิม) ...
  const irisVal = Form.useWatch('iris_id', form) || '';
  const foreignIdVal = Form.useWatch('foreign_id', form) || '';
  const passportVal = Form.useWatch('passport_id', form) || '';
  const idCardVal = Form.useWatch('id_card', form) || '';
  const phoneVal = Form.useWatch('phone_number', form) || '';
  const phoneVal1 = Form.useWatch('phone_number1', form) || '';
  const formerlyemployed = Form.useWatch('formerly_employed', form);
  const foreignWorkers = Form.useWatch('foreign_workers', form);
  const canType = Form.useWatch('can_type', form);
  const hasCarLicense = Form.useWatch('has_car_license', form);
  const hasMotorcycleLicense = Form.useWatch('has_motorcycle_license', form);
  const ssoRegistered = Form.useWatch('sso_registered', form);
  const disabledPerson = Form.useWatch('disabled_person', form);
  const disabledGuarantor = Form.useWatch('has_guarantor', form);
  const selectedCompanyCode = Form.useWatch('company_code', form);
  const selectedBranchCode = Form.useWatch('branch_code', form);
  const selectedDepCode = Form.useWatch('dep_code', form);

  const irisOk = isAlnumRange(irisVal, 13, 13);
  const irisShow = irisVal.length > 0;
  const foreignOk = isDigits(foreignIdVal, 13);
  const foreignShow = foreignIdVal.length > 0;
  const passportOk = isAlnumRange(passportVal, 7, 13);
  const passportShow = passportVal.length > 0;
  const idCardOk = isDigits(idCardVal, 13);
  const idCardShow = idCardVal.length > 0;
  const phoneOk = isDigits(phoneVal, 10);
  const phoneShow = phoneVal.length > 0;
  const phone1Ok = isDigits(phoneVal1, 10);
  const phone1Show = phoneVal1.length > 0;
  const ssoOk = isDigits(foreignIdVal, 13);
  const ssoShow = foreignIdVal.length > 0;

  const hasInvalid = (irisShow && !irisOk) || (foreignShow && !foreignOk) ||
    (passportShow && !passportOk) || (idCardShow && !idCardOk) ||
    (phoneShow && !phoneOk) || (phone1Show && !phone1Ok) || (ssoShow && !ssoOk);

  // ... (Memos & Utils - คงเดิม) ...
  const companyByCode = useMemo(() => { const m = new Map(); (options.companies || []).forEach(c => m.set(String(c.company_code), c.company_name_th)); return m; }, [options.companies]);
  const companyByName = useMemo(() => { const m = new Map(); (options.companies || []).forEach(c => m.set(String(c.company_name_th), c.company_code)); return m; }, [options.companies]);
  const branchByCode = useMemo(() => { const m = new Map(); (options.branches || []).forEach(b => m.set(String(b.branch_code), b.branch)); return m; }, [options.branches]);
  const branchByName = useMemo(() => { const m = new Map(); (options.branches || []).forEach(b => m.set(String(b.branch), b.branch_code)); return m; }, [options.branches]);
  const depByCode = useMemo(() => { const m = new Map(); (options.departments || []).forEach(d => m.set(String(d.dep_code), d.department)); return m; }, [options.departments]);
  const depByName = useMemo(() => { const m = new Map(); (options.departments || []).forEach(d => m.set(String(d.department), d.dep_code)); return m; }, [options.departments]);

  const onCompanyCodeChange = (code) => form.setFieldsValue({ company: companyByCode.get(String(code)) || null });
  const onCompanyNameChange = (name) => {
    const code = companyByName.get(String(name));
    form.setFieldsValue({
      company_code: code || null,
      // เคลียร์ค่าลูกโซ่ทั้งหมดเมื่อเปลี่ยนบริษัท
      branch: null, branch_code: null,
      department: null, dep_code: null,
      position: null
    });
  };
  const onBranchCodeChange = (code) => form.setFieldsValue({ branch: branchByCode.get(String(code)) || null });
  const onBranchNameChange = (name) => {
    const code = branchByName.get(String(name));
    form.setFieldsValue({
      branch_code: code || null,
      // เคลียร์ค่าแผนกและตำแหน่งเมื่อเปลี่ยนสาขา
      department: null, dep_code: null,
      position: null
    });
  };
  const onDepCodeChange = (code) => form.setFieldsValue({ department: depByCode.get(String(code)) || null });
  const onDepNameChange = (name) => {
    const code = depByName.get(String(name));
    form.setFieldsValue({
      dep_code: code || null,
      // เคลียร์ตำแหน่งเมื่อเปลี่ยนแผนก
      position: null
    });
  };

  // ... (Fetch Logic - คงเดิม) ...
  const fetchOptions = useCallback(async () => {
    const { data } = await api.get('/employee/options');
    setOptions(data?.data || {});
  }, []);

  const fetchNextCode = useCallback(async () => {
    const { data } = await api.get('/employee/next-code');
    setLastCode(data?.last_code ?? null);
  }, []);

  const loadWorkHistory = useCallback(async () => {
    if (!employee?.employee_id) return;
    setWorkHistory(w => ({ ...w, loading: true }));
    const { data } = await api.get(`/workhistory/${employee.employee_id}`);
    setWorkHistory({ rows: Array.isArray(data) ? data : data?.rows || [], loading: false });
  }, [employee?.employee_id]);

  const loadRelatives = useCallback(async () => {
    if (!employee?.employee_id) return;
    setRelatives(r => ({ ...r, loading: true }));
    const { data } = await api.get(`/relatives/${employee.employee_id}`);
    setRelatives({ rows: Array.isArray(data) ? data : data?.rows || [], loading: false });
  }, [employee?.employee_id]);

  const fetchDetail = useCallback(async (id) => {
    const { data } = await api.get(`/employee/detail/${id}`);
    const row = data?.data || {};
    setOriginalCode(row.employee_code || '');

    const out = { ...row };
    const bools = ['has_guarantor', 'disabled_person', 'foreign_workers', 'sso_registered', 'sso_card_lost', 'sso_card_expired', 'has_car_license', 'has_motorcycle_license', 'formerly_employed', 'has_guarantor', 'can_type'];
    bools.forEach(k => out[k] = !!(row[k] === 1 || row[k] === '1' || row[k] === true));
    out.permission_status = row.permission_status === 'activate' || row.permission_status === 1;

    const dates = ['sign_date', 'resign_date', 'job_date', 'idcard_sdate', 'idcard_edate', 'sso_received_date', 'birthdate'];
    dates.forEach(k => { if (row[k]) out[k] = dayjs(row[k]); });

    form.setFieldsValue(out);
    if (row.employee_img) setEmpImgPreview(publicUrl(row.employee_img));

    if (out.birthdate) {
      const result = calculateAgeThai(out.birthdate);
      if (result) setCalculatedAgeString(result.ageString);
    }
  }, [form]);

  // ... (Effects - คงเดิม) ...
  useEffect(() => {
    fetchOptions().catch(console.error);
    try {
      if (typeof window !== 'undefined') {
        const candidateKeys = ['employee', 'currentEmployee', 'user', 'currentUser', 'authUser'];
        let role = '';
        for (const key of candidateKeys) {
          const raw = window.localStorage?.getItem(key);
          if (raw) {
            const obj = JSON.parse(raw);
            if (obj?.permission_role) role = String(obj.permission_role).toLowerCase();
            else if (obj?.role) role = String(obj.role).toLowerCase();
          }
          if (role) break;
        }
        setCanShowPermissionStatus(role ? (role === 'admin' || role === 'administrator') : true);
      }
    } catch { setCanShowPermissionStatus(true); }

    if (isEdit) {
      setWorkStatusTouched(false);
      fetchDetail(employee.employee_id);
      loadWorkHistory();
      loadRelatives();
    } else {
      fetchNextCode().catch(console.error);
      form.setFieldsValue({
        disabled_person: false, permission_status: false, foreign_workers: false,
        sso_registered: false, sso_card_lost: false, sso_card_expired: false,
        has_car_license: false, has_motorcycle_license: false, formerly_employed: false,
        has_guarantor: false, same_as_reg: false,
      });
      setWorkStatusTouched(true);
    }
  }, [fetchOptions, fetchNextCode, fetchDetail, loadWorkHistory, loadRelatives, isEdit, employee, form]);

  // List ตัวเลือกที่ถูกกรอง (Filtered Options)
  // กรองสาขา: แสดงเฉพาะที่ company_code ตรงกับบริษัทที่เลือก
  const filteredBranches = useMemo(() => {
    if (!options.branches) return [];
    if (!selectedCompanyCode) return []; // ถ้าไม่เลือกบริษัท ไม่แสดงสาขา
    return options.branches.filter(b => String(b.company_code) === String(selectedCompanyCode));
  }, [options.branches, selectedCompanyCode]);
  // กรองแผนก: แสดงเฉพาะที่ branch_code ตรงกับสาขาที่เลือก
  const filteredDepartments = useMemo(() => {
    if (!options.departments) return [];
    if (!selectedBranchCode) return []; // ถ้าไม่เลือกสาขา ไม่แสดงแผนก
    return options.departments.filter(d => String(d.branch_code) === String(selectedBranchCode));
  }, [options.departments, selectedBranchCode]);
  // กรองตำแหน่ง: แสดงเฉพาะที่ department_code ตรงกับแผนกที่เลือก
  const filteredPositions = useMemo(() => {
    if (!options.positions) return [];
    if (!selectedDepCode) return []; // ถ้าไม่เลือกแผนก ไม่แสดงตำแหน่ง
    return options.positions.filter(p => String(p.department_code) === String(selectedDepCode));
  }, [options.positions, selectedDepCode]);

  // ... (Handlers - คงเดิม) ...
  const checkDup = useCallback(async (code) => {
    if (!code) { setCodeStatus({ status: '', help: '' }); setCodeDup(false); return; }
    if (isEdit && String(code).trim() === String(originalCode).trim()) {
      setCodeStatus({ status: 'success', help: 'รหัสเดิม (ใช้งานได้)' }); setCodeDup(false); return;
    }
    try {
      const { data } = await api.get('/employee/check-code', { params: { employee_code: code } });
      if (data?.exists) { setCodeStatus({ status: 'error', help: 'รหัสนี้ถูกใช้งานแล้ว' }); setCodeDup(true); }
      else { setCodeStatus({ status: 'success', help: 'รหัสนี้ยังว่าง ใช้งานได้' }); setCodeDup(false); }
    } catch { setCodeStatus({ status: 'error', help: 'ตรวจสอบรหัสไม่สำเร็จ' }); setCodeDup(true); }
  }, [isEdit, originalCode]);

  const onValuesChange = (changed, all) => {
    if (all.same_as_reg) {
      const keys = ['reg_addr_no', 'village_name', 'village_no', 'alley', 'junction', 'road', 'subdistrict', 'district', 'province', 'postcode', 'phone_number'];
      if (Object.keys(changed).some(k => keys.includes(k))) syncCurrentAddress();
    }
    if (Object.prototype.hasOwnProperty.call(changed, 'employee_code')) {
      const val = changed.employee_code || '';
      if (typingTimer) clearTimeout(typingTimer);
      setTypingTimer(setTimeout(() => { checkDup(val.trim()); }, 400));
    }
  };

  const syncCurrentAddress = () => {
    const v = form.getFieldsValue(true);
    form.setFieldsValue({
      curr_addr_no: v.reg_addr_no, village_name1: v.village_name, village_no1: v.village_no,
      alley1: v.alley, junction1: v.junction, road1: v.road, subdistrict1: v.subdistrict,
      district1: v.district, province1: v.province, postcode1: v.postcode, phone_number1: v.phone_number,
    });
  };

  const openLocationPicker = (target) => { setLocationTarget(target); setLocationOpen(true); };
  const handlePickLocation = (row) => {
    if (locationTarget === 'issued') {
      form.setFieldsValue({ issued_province: row.province_name_th || '', issued_district: row.district_name_th || '' });
    } else if (locationTarget === 'reg') {
      form.setFieldsValue({ province: row.province_name_th || '', district: row.district_name_th || '', subdistrict: row.subdistrict_name_th || '', postcode: row.zip_code || '' });
    } else if (locationTarget === 'curr') {
      form.setFieldsValue({ province1: row.province_name_th || '', district1: row.district_name_th || '', subdistrict1: row.subdistrict_name_th || '', postcode1: row.zip_code || '' });
    }
    setLocationOpen(false);
  };

  const beforeUploadEmp = (file) => {
    if (!file?.type?.startsWith('image/')) { message.error('อัปโหลดได้เฉพาะไฟล์รูปภาพ'); return Upload.LIST_IGNORE; }
    setEmpImgFile(file);
    setEmpImgPreview(URL.createObjectURL(file));
    return false;
  };
  const clearEmpImg = () => { setEmpImgFile(null); if (empImgPreview) URL.revokeObjectURL(empImgPreview); setEmpImgPreview(null); };

  const onBirthdateChange = (date) => {
    const result = calculateAgeThai(date);
    if (result) { setCalculatedAgeString(result.ageString); form.setFieldsValue({ age: result.ageString }); }
    else { setCalculatedAgeString(''); form.setFieldsValue({ age: '' }); }
  };

  // ... (onFinish - คงเดิม) ...
  const onFinish = async (values) => {
    try {
      if (hasInvalid) { message.error('กรุณากรอกเลข/รูปแบบให้ถูกต้องครบถ้วนตามเงื่อนไขที่กำหนด'); return; }
      if (codeDup) { message.error('รหัสพนักงานซ้ำ กรุณาเปลี่ยนรหัส'); return; }

      setSubmitting(true);
      const payload = { ...values };
      if (payload.permission_status === true) payload.permission_status = 'activate';
      else delete payload.permission_status;

      const dateFields = ['sign_date', 'resign_date', 'job_date', 'idcard_sdate', 'idcard_edate', 'sso_received_date', 'birthdate'];
      dateFields.forEach(k => { if (payload[k]) payload[k] = dayjs(payload[k]).format('YYYY-MM-DD'); });

      let savedEmployeeId = null;
      if (isEdit) {
        savedEmployeeId = employee.employee_id;
        await api.put(`/employee/${savedEmployeeId}`, payload);
        message.success('อัปเดตข้อมูลพนักงานสำเร็จ');
      } else {
        const { data } = await api.post('/employee', payload);
        savedEmployeeId = data?.data?.employee_id;
        message.success('เพิ่มพนักงานสำเร็จ');
      }

      if (empImgFile && savedEmployeeId) {
        const fd = new FormData();
        fd.append('image', empImgFile);
        await api.post(`/employee/${savedEmployeeId}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      if (isEdit) { await fetchDetail(savedEmployeeId); }
      else { clearEmpImg(); form.resetFields(); onSuccess?.(); }

    } catch (err) {
      console.error(err);
      message.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSubmitting(false); }
  };
  const onFinishFailed = () => message.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน!');

  // ... (Tab 1, 2, 3 - คงเดิม) ...
  // เพื่อความกระชับ ขอละส่วน Tab 1, Tab 2, Tab 3 ไว้ เพราะเหมือนเดิม 100%
  // คุณสามารถ copy code จากไฟล์เดิมมาใส่ได้เลย
  const tab1 = ( /* ใส่โค้ดเดิมของ tab1 */
    <Row gutter={24} style={{ flex: 1, paddingTop: 16 }}>
      <Col xs={24} lg={12} style={{ paddingRight: 12 }}>
        {canShowPermissionStatus && (
          <Form.Item name="permission_status" valuePropName="checked" style={compactStyle} {...chkLayout}>
            <Checkbox>อนุญาตให้สามารถเข้าระบบได้ <Text type="secondary">(หลังแอดมินดำเนินการ)</Text></Checkbox>
          </Form.Item>
        )}
        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>ใบสมัครงาน</Title>
        <Form.Item name="formerly_employed" valuePropName="checked" style={compactStyle} {...chkLayout}>
          <Checkbox>เคยร่วมงานกับทางบริษัท</Checkbox>
        </Form.Item>
        <Form.Item label="รายละเอียด (ถ้าเคย)" name="formerly_employed_detail" {...fullLayout} style={compactStyle}>
          <Input.TextArea rows={2} disabled={!formerlyemployed} />
        </Form.Item>
        <Form.Item label="รูปภาพพนักงาน" {...fullLayout} style={compactStyle}>
          <Upload listType="picture-card" maxCount={1} accept="image/*" beforeUpload={beforeUploadEmp} onRemove={clearEmpImg} showUploadList={!!empImgPreview} fileList={empImgPreview ? [{ uid: '-1', name: 'employee.jpg', status: 'done', url: empImgPreview }] : []}>
            {!empImgPreview && <div>เลือกไฟล์</div>}
          </Upload>
        </Form.Item>
        <Form.Item label="เลขที่ใบสมัคร" name="jobapp_number" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="วันที่สมัคร" name="job_date" {...fullLayout} style={compactStyle}><ThaiDateInput /></Form.Item>
        <Form.Item label="เงินเดือน" name="salary" {...fullLayout} style={compactStyle}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
        <Form.Item label="ทราบข่าวรับสมัครจาก" name="recruitment_source" {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.recruitmentSources || []).map(x => ({ value: x.recruitment_source, label: x.recruitment_source }))} placeholder="กรุณาเลือก" />
        </Form.Item>

        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>นายจ้าง/ผู้ประกอบการ</Title>
        <Form.Item label="วันเริ่มทำงาน" name="sign_date" {...fullLayout} style={compactStyle}><ThaiDateInput /></Form.Item>
        <Form.Item label="สถานะการทำงาน" name="working_status" {...fullLayout} style={compactStyle}>
          <S
            {...selProps}
            options={(options.workingStatuses || []).map(s => ({ value: s.working_status, label: s.working_status }))}
            placeholder="กรุณาเลือก"
            onSelect={() => setWorkStatusTouched(true)} // เมื่อมีการเลือก (แม้จะเลือกอันเดิม) ให้ปลดล็อค
          />
        </Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">รหัสพนักงาน</span>} name="employee_code" validateStatus={codeStatus.status} help={codeStatus.help} rules={[{ required: true, message: 'กรุณากรอกรหัสพนักงาน' }]} extra={(!isEdit && lastCode) ? <Text type="secondary">รหัสล่าสุด: {lastCode}</Text> : null} {...fullLayout} style={compactStyle}>
          <Input placeholder="เช่น 100001" disabled={isEdit && !workStatusTouched} />
        </Form.Item>
        <Form.Item hidden label="รหัสบริษัท" name="company_code" {...fullLayout} style={compactStyle}><S {...selProps} options={(options.companies || []).map(c => ({ value: c.company_code, label: c.company_code }))} onChange={onCompanyCodeChange} /></Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">บริษัท</span>} name="company" rules={[{ required: true, message: 'กรุณาเลือกบริษัท' }]} {...fullLayout} style={compactStyle}>
          <S
            {...selProps}
            disabled={isEdit && !workStatusTouched}
            options={(options.companies || []).map(c => ({ value: c.company_name_th, label: c.company_name_th }))}
            onChange={onCompanyNameChange}
            placeholder="กรุณาเลือก"
          />
        </Form.Item>
        <Form.Item hidden label="รหัสสาขา" name="branch_code" {...fullLayout} style={compactStyle}><S {...selProps} options={(options.branches || []).map(b => ({ value: b.branch_code, label: b.branch_code }))} onChange={onBranchCodeChange} /></Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">สาขา</span>} name="branch" rules={[{ required: true, message: 'กรุณาเลือกสาขา' }]} {...fullLayout} style={compactStyle}>
          <S
            {...selProps}
            disabled={(!selectedCompanyCode) || (isEdit && !workStatusTouched)} // ล็อคถ้ายังไม่เลือกบริษัท
            // ❗ ใช้ filteredBranches แทน options.branches
            options={filteredBranches.map(b => ({ value: b.branch, label: b.branch }))}
            onChange={onBranchNameChange}
            placeholder={selectedCompanyCode ? "กรุณาเลือก" : "กรุณาเลือกบริษัทก่อน"}
          />
        </Form.Item>
        <Form.Item hidden label="รหัสแผนก" name="dep_code" {...fullLayout} style={compactStyle}><S {...selProps} options={(options.departments || []).map(d => ({ value: d.dep_code, label: d.dep_code }))} onChange={onDepCodeChange} /></Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">แผนก</span>} name="department" rules={[{ required: true, message: 'กรุณาเลือกแผนก' }]} {...fullLayout} style={compactStyle}>
          <S
            {...selProps}
            disabled={(!selectedBranchCode) || (isEdit && !workStatusTouched)} // ล็อคถ้ายังไม่เลือกสาขา
            // ❗ ใช้ filteredDepartments แทน options.departments
            options={filteredDepartments.map(d => ({ value: d.department, label: d.department }))}
            onChange={onDepNameChange}
            placeholder={selectedBranchCode ? "กรุณาเลือก" : "กรุณาเลือกสาขาก่อน"}
          />
        </Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">ตำแหน่ง</span>} name="position" rules={[{ required: true, message: 'กรุณาเลือกตำแหน่ง' }]} {...fullLayout} style={compactStyle}>
          <S
            {...selProps}
            disabled={(!selectedDepCode) || (isEdit && !workStatusTouched)} // ล็อคถ้ายังไม่เลือกแผนก
            // ❗ ใช้ filteredPositions แทน options.positions
            options={filteredPositions.map(p => ({ value: p.position, label: p.position }))}
            placeholder={selectedDepCode ? "กรุณาเลือก" : "กรุณาเลือกแผนกก่อน"}
          />
        </Form.Item>
        <Form.Item label="ไซต์งาน" name="worksites" {...fullLayout} style={compactStyle}>
          <S
            {...selProps}
            disabled={isEdit && !workStatusTouched} // ล็อค
            options={(options.worksites || []).map(w => ({ value: w.worksites, label: w.worksites }))}
            placeholder="กรุณาเลือก"
          />
        </Form.Item>
        <Form.Item label="ประเภทพนักงาน" name="employee_type" {...fullLayout} style={compactStyle}>
          <S
            {...selProps}
            disabled={isEdit && !workStatusTouched} // ล็อค
            options={(options.employeeTypes || []).map(e => ({ value: e.employee_type, label: e.employee_type }))}
            placeholder="กรุณาเลือก"
          />
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>ข้อมูลระบุตัวบุคคล</Title>
          <Button type="primary" size="small" icon={<HomeOutlined />} onClick={() => openLocationPicker('issued')}>เลือกพื้นที่</Button>
        </div>
        <Form.Item name="foreign_workers" valuePropName="checked" label="แรงงานต่างด้าว" style={compactStyle} {...fullLayout}><Checkbox>แรงงานต่างด้าว</Checkbox></Form.Item>
        <Form.Item label="IRIS ID" name="iris_id" {...fullLayout} style={compactStyle} rules={[alnumRule(13, 13, 'ต้องเป็น A-Z,a-z,0-9 ความยาว 13 ตัว')]}>
          <Input maxLength={13} disabled={!foreignWorkers} onChange={(e) => form.setFieldsValue({ iris_id: onlyAlnum(e.target.value).slice(0, 13) })} suffix={<StatusIcon ok={irisOk} show={irisShow} />} placeholder="A-Z, a-z, 0-9 จำนวน 13 ตัว" />
        </Form.Item>
        <Form.Item label="เลขอ้างอิงต่างด้าว" name="foreign_id" {...fullLayout} style={compactStyle} rules={[digitsRule(13, 'กรอกเป็นตัวเลข 13 หลัก')]}>
          <Input inputMode="numeric" maxLength={13} disabled={!foreignWorkers} onChange={(e) => form.setFieldsValue({ foreign_id: onlyDigits(e.target.value).slice(0, 13) })} suffix={<StatusIcon ok={foreignOk} show={foreignShow} />} placeholder="ตัวเลข 13 หลัก" />
        </Form.Item>
        <Form.Item label="เลขที่หนังสือเดินทาง" name="passport_id" {...fullLayout} style={compactStyle} rules={[alnumRule(7, 13, 'ต้องเป็น A-Z,a-z,0-9 ยาว 7–13 ตัว')]}>
          <Input maxLength={13} disabled={!foreignWorkers} onChange={(e) => form.setFieldsValue({ passport_id: onlyAlnum(e.target.value).slice(0, 13) })} suffix={<StatusIcon ok={passportOk} show={passportShow} />} placeholder="A-Z, a-z, 0-9 ยาว 7–13 ตัว" />
        </Form.Item>
        <Form.Item label="เลขบัตรประชาชน" name="id_card" {...fullLayout} style={compactStyle} rules={[digitsRule(13, 'กรุณากรอกเลขบัตรประชาชน 13 หลัก')]}>
          <Input inputMode="numeric" maxLength={13} onChange={(e) => form.setFieldsValue({ id_card: onlyDigits(e.target.value).slice(0, 13) })} suffix={<StatusIcon ok={idCardOk} show={idCardShow} />} placeholder="ตัวเลข 13 หลัก" />
        </Form.Item>
        <Form.Item label="ออกให้ที่จังหวัด" name="issued_province" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="ออกให้ที่อำเภอ" name="issued_district" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="วันออกบัตร" name="idcard_sdate" {...fullLayout} style={compactStyle}><ThaiDateInput /></Form.Item>
        <Form.Item label="วันหมดอายุ" name="idcard_edate" {...fullLayout} style={compactStyle}><ThaiDateInput /></Form.Item>

        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>ประวัติส่วนตัว</Title>
        <Form.Item label="วันเกิด" name="birthdate" {...fullLayout} style={compactStyle}><ThaiDateInput onValueChange={onBirthdateChange} /></Form.Item>
        <Form.Item label="อายุ (ปี)" name="age" {...fullLayout} style={compactStyle}><Input style={{ width: '100%' }} readOnly /></Form.Item>
        <Form.Item label="สถานที่เกิด" name="birthplace" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="สัญชาติ" name="nationality" rules={[{ required: false, message: 'กรุณาเลือกสัญชาติ' }]} {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.nationalities || []).map(x => ({ value: x.nationality, label: x.nationality }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="เชื้อชาติ" name="ethnicity" rules={[{ required: false, message: 'กรุณาเลือกเชื้อชาติ' }]} {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.ethnicities || []).map(x => ({ value: x.ethnicity, label: x.ethnicity }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">เพศ</span>} name="gender" rules={[{ required: true, message: 'กรุณาเลือกเพศ' }]} {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.genders || []).map(g => ({ value: g.gender, label: g.gender }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">คำนำหน้า (ไทย)</span>} name="titlename_th" rules={[{ required: true, message: 'กรุณาเลือกคำนำหน้าชื่อ (ไทย)' }]} {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.titlename || []).map(t => ({ value: t.name_th, label: t.name_th }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">ชื่อ (ไทย)</span>} name="firstname_th" rules={[{ required: true, message: 'กรุณากรอกชื่อ (ไทย)' }]} {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">นามสกุล (ไทย)</span>} name="lastname_th" rules={[{ required: true, message: 'กรุณากรอกนามสกุล (ไทย)' }]} {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">คำนำหน้า (อังกฤษ)</span>} name="titlename_en" rules={[{ required: true, message: 'กรุณากรอกชื่อ (ไทย)' }]} {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.titlename || []).map(t => ({ value: t.name_en, label: t.name_en }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">ชื่อ (อังกฤษ)</span>} name="firstname_en" rules={[{ required: true, message: 'กรุณากรอกชื่อ (อังกฤษ)' }]} {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label={<span className="text-red-500 font-bold">นามสกุล (อังกฤษ)</span>} name="lastname_en" rules={[{ required: true, message: 'กรุณากรอกนามสกุล (อังกฤษ)' }]} {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="น้ำหนัก (กก.)" name="weight_kg" {...fullLayout} style={compactStyle}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="ส่วนสูง (ซม.)" name="height_cm" {...fullLayout} style={compactStyle}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="ศาสนา" name="religion" {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.religions || []).map(x => ({ value: x.religion, label: x.religion }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="กรุ๊ปเลือด" name="blood_group" {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.bloodgroups || []).map(x => ({ value: x.blood_group, label: x.blood_group }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="สถานะครอบครัว" name="marital_status" {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.maritalStatuses || []).map(x => ({ value: x.marital_status, label: x.marital_status }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="สถานะทางทหาร" name="military_status" {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.militaryStatuses || []).map(x => ({ value: x.military_status, label: x.military_status }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="หมายเหตุทางทหาร" name="military_remark" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="วุฒิการศึกษา" name="education" {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.educations || []).map(x => ({ value: x.education, label: x.education }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item
          label="ชื่อสถานศึกษา"
          name="education_institution"
          {...fullLayout}
          style={compactStyle}
        >
          <AutoComplete
            allowClear
            size="small"
            options={(options.educationInstitutions || [])
              .map((x) => String(x.education_institution || '').trim())
              .filter(Boolean)
              .map((v) => ({ value: v }))}
            filterOption={(input, option) =>
              String(option?.value || '').toLowerCase().includes(String(input || '').toLowerCase())
            }
            placeholder="พิมพ์ชื่อสถานศึกษา หรือเลือกจากรายการ"
            dropdownStyle={{ maxHeight: 320, overflowY: 'auto' }}
            getPopupContainer={(trigger) => trigger.parentNode}
          >
            <Input />
          </AutoComplete>
        </Form.Item>
        <Form.Item label="สาขาที่เรียน" name="major" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="ปีสำเร็จ (พ.ศ.)" name="grad_year_be" {...fullLayout} style={compactStyle}><InputNumber min={2400} max={3000} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="งานอดิเรก" name="hobbies" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item name="can_type" valuePropName="checked" style={compactStyle} {...chkLayout}><Checkbox>พิมพ์ดีดได้</Checkbox></Form.Item>
        <Form.Item label="พิมพ์ภาษาไทย" name="typing_speed_th" {...fullLayout} style={compactStyle}><InputNumber min={0} disabled={!canType} style={{ width: '100%' }} placeholder="คำ/นาที" /></Form.Item>
        <Form.Item label="พิมพ์ภาษาอังกฤษ" name="typing_speed_en" {...fullLayout} style={compactStyle}><InputNumber min={0} disabled={!canType} style={{ width: '100%' }} placeholder="คำ/นาที" /></Form.Item>
        <Form.Item label="โปรแกรมคอมพิวเตอร์" name="computer_skills" {...fullLayout} style={compactStyle}><Input.TextArea rows={2} /></Form.Item>
      </Col>

      <Col xs={24} lg={12} style={{ paddingLeft: 12, borderLeft: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>ที่อยู่ตามบัตรประชาชน/ทะเบียนบ้าน</Title>
          <Button type="primary" size="small" icon={<HomeOutlined />} onClick={() => openLocationPicker('reg')}>เลือกพื้นที่</Button>
        </div>
        <Form.Item label="บ้านเลขที่" name="reg_addr_no" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="ชื่อหมู่บ้าน" name="village_name" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="หมู่ที่" name="village_no" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="ซอย" name="alley" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="แยก" name="junction" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="ถนน" name="road" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="แขวง/ตำบล" name="subdistrict" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="เขต/อำเภอ" name="district" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="จังหวัด" name="province" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="รหัสไปรษณีย์" name="postcode" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="เบอร์โทรศัพท์" name="phone_number" {...fullLayout} style={compactStyle} rules={[digitsRule(10, 'กรอกเป็นตัวเลข 10 หลัก')]}>
          <Input inputMode="numeric" maxLength={10} onChange={(e) => form.setFieldsValue({ phone_number: onlyDigits(e.target.value).slice(0, 10) })} suffix={<StatusIcon ok={phoneOk} show={phoneShow} />} placeholder="ตัวเลข 10 หลัก" />
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>ที่พักอาศัยปัจจุบัน</Title>
          <Button type="primary" size="small" icon={<HomeOutlined />} onClick={() => openLocationPicker('curr')}>เลือกพื้นที่</Button>
        </div>
        <Form.Item name="same_as_reg" valuePropName="checked" style={compactStyle} {...chkLayout}>
          <Checkbox onChange={(e) => { if (e.target.checked) syncCurrentAddress(); }}>ที่อยู่ปัจจุบันเหมือน “ที่อยู่ตามบัตรประชาชน/ทะเบียนบ้าน”</Checkbox>
        </Form.Item>
        <Form.Item label="บ้านเลขที่" name="curr_addr_no" {...fullLayout} style={compactStyle}><Input /></Form.Item>

        <Form.Item label="ชื่อหมู่บ้าน" name="village_name1" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="หมู่ที่" name="village_no1" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="ซอย" name="alley1" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="แยก" name="junction1" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="ถนน" name="road1" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="แขวง/ตำบล" name="subdistrict1" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="เขต/อำเภอ" name="district1" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="จังหวัด" name="province1" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="รหัสไปรษณีย์" name="postcode1" {...fullLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="เบอร์โทรศัพท์" name="phone_number1" {...fullLayout} style={compactStyle} rules={[digitsRule(10, 'กรอกเป็นตัวเลข 10 หลัก')]}>
          <Input inputMode="numeric" maxLength={10} onChange={(e) => form.setFieldsValue({ phone_number1: onlyDigits(e.target.value).slice(0, 10) })} suffix={<StatusIcon ok={phone1Ok} show={phone1Show} />} placeholder="ตัวเลข 10 หลัก" />
        </Form.Item>
        <Form.Item label="ระยะทางที่พักถึงที่ทำงาน" name="commute_distance" {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.commuteDistances || []).map(x => ({ value: x.commute_distance, label: x.commute_distance }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="ประเภทของที่อยู่อาศัย" name="residence_type" {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.residenceTypes || []).map(x => ({ value: x.residence_type, label: x.residence_type }))} placeholder="กรุณาเลือก" />
        </Form.Item>

        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>ใบขับขี่</Title>
        <Form.Item name="has_car_license" valuePropName="checked" style={compactStyle} {...chkLayout}><Checkbox>มีใบขับขี่รถยนต์</Checkbox></Form.Item>
        <Form.Item label="เลขที่ใบขับขี่รถยนต์" name="car_license_number" {...fullLayout} style={compactStyle}><Input disabled={!hasCarLicense} /></Form.Item>
        <Form.Item name="has_motorcycle_license" valuePropName="checked" style={compactStyle} {...chkLayout}><Checkbox>มีใบขับขี่จักรยานยนต์</Checkbox></Form.Item>
        <Form.Item label="เลขที่ใบขับขี่จักรยานยนต์" name="motorcycle_license_number" {...fullLayout} style={compactStyle}><Input disabled={!hasMotorcycleLicense} /></Form.Item>

        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>สิทธิสวัสดิการประกันสังคม</Title>
        <Form.Item name="sso_registered" valuePropName="checked" style={compactStyle} {...chkLayout}><Checkbox>เคยทำประกันสังคมแล้ว</Checkbox></Form.Item>
        <Form.Item label="โรงพยาบาล" name="sso_hospital" {...fullLayout} style={compactStyle}>
          <S {...selProps} disabled={!ssoRegistered} options={(options.ssoHospitals || []).map(x => ({ value: x.sso_hospital, label: x.sso_hospital }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="หมายเลขบัตร" name="sso_number" {...fullLayout} style={compactStyle} rules={[digitsRule(13, 'กรุณากรอกหมายเลขบัตร 13 หลัก')]}>
          <Input inputMode="numeric" maxLength={13} disabled={!ssoRegistered} onChange={(e) => form.setFieldsValue({ sso_number: onlyDigits(e.target.value).slice(0, 13) })} suffix={<StatusIcon ok={ssoOk} show={ssoShow} />} placeholder="ตัวเลข 13 หลัก" />
        </Form.Item>
        <Form.Item label="วันที่รับบัตร" name="sso_received_date" {...fullLayout} style={compactStyle}><ThaiDateInput disabled={!ssoRegistered} /></Form.Item>
        <Form.Item name="sso_card_lost" valuePropName="checked" style={compactStyle} {...chkLayout}><Checkbox disabled={!ssoRegistered}>สูญหาย</Checkbox></Form.Item>
        <Form.Item name="sso_card_expired" valuePropName="checked" style={compactStyle} {...chkLayout}><Checkbox disabled={!ssoRegistered}>หมดอายุ</Checkbox></Form.Item>
        <Form.Item label="รพ. ทางเลือก 1" name="sso_hospital_alt1" {...fullLayout} style={compactStyle}>
          <S {...selProps} disabled={!ssoRegistered} options={(options.ssoHospitals || []).map(x => ({ value: x.sso_hospital, label: x.sso_hospital }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="รพ. ทางเลือก 2" name="sso_hospital_alt2" {...fullLayout} style={compactStyle}>
          <S {...selProps} disabled={!ssoRegistered} options={(options.ssoHospitals || []).map(x => ({ value: x.sso_hospital, label: x.sso_hospital }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="ภาระค่าใช้จ่าย/เดือน" name="monthly_financial_burden" {...fullLayout} style={compactStyle}><Input /></Form.Item>

        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>สถานะ & หมายเหตุ</Title>
        <Form.Item name="disabled_person" valuePropName="checked" style={compactStyle} {...chkLayout}><Checkbox>สถานะการเป็นผู้พิการ</Checkbox></Form.Item>
        <Form.Item label="ประเภทผู้พิการ" name="disabled_type" {...fullLayout} style={compactStyle}>
          <S {...selProps} disabled={!disabledPerson} options={(options.disabledtypes || []).map(s => ({ value: s.disabled_type, label: s.disabled_type }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="หมายเหตุทั่วไป" name="general_remark" {...fullLayout} style={compactStyle}><Input.TextArea rows={3} placeholder="อธิบายรายละเอียดเพิ่มเติม" /></Form.Item>
        <Form.Item label="หมายเหตุ" name="person_remark" {...fullLayout} style={compactStyle}><Input.TextArea rows={3} placeholder="อธิบายรายละเอียดเพิ่มเติม (บุคคลต้องห้าม)" /></Form.Item>
        <Form.Item label="สาเหตุการออก" name="resign_reason" {...fullLayout} style={compactStyle}>
          <S {...selProps} options={(options.resignReasons || []).map(r => ({ value: r.resign_reason, label: r.resign_reason }))} placeholder="กรุณาเลือก" />
        </Form.Item>
        <Form.Item label="วันที่ลาออก" name="resign_date" {...fullLayout} style={compactStyle}><ThaiDateInput /></Form.Item>
        <Form.Item name="has_guarantor" valuePropName="checked" style={compactStyle} {...chkLayout}><Checkbox>มีผู้ค้ำประกัน</Checkbox></Form.Item>
        <Form.Item label="ชื่อผู้ค้ำประกัน" name="guarantor_name" {...fullColLayout} style={compactStyle}><Input disabled={!disabledGuarantor} /></Form.Item>
      </Col>
    </Row>
  );

  const tab2 = (
    <Row gutter={24} style={{ flex: 1, paddingTop: 16 }}>
      <Col xs={24} lg={12} style={{ paddingRight: 12 }}>
        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>ข้อมูลเพิ่มเติม</Title>
        <Form.Item label="แพ้ยา" name="drug_allergy" {...fullLayout} style={compactStyle}><Input.TextArea rows={4} placeholder="ชนิดยาที่แพ้" /></Form.Item>
        <Form.Item label="ข้อมูลการแพ้ยา" name="drug_allergy_info" {...fullLayout} style={compactStyle}><Input.TextArea rows={4} placeholder="ข้อมูลการแพ้ยา" /></Form.Item>
        <Form.Item label="ข้อมูลการรักษา" name="treatment_info" {...fullLayout} style={compactStyle}><Input.TextArea rows={4} placeholder="ข้อมูลการรักษาที่เคยได้รับ" /></Form.Item>
      </Col>
      <Col xs={24} lg={12} style={{ paddingLeft: 12, borderLeft: '1px solid #f0f0f0' }}>
        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>ข้อมูลอื่น ๆ</Title>
        <Form.Item label="โรคประจำตัว" name="chronic_disease" {...fullLayout} style={compactStyle}><Input.TextArea rows={4} placeholder="ระบุข้อมูลโรคประจำตัว" /></Form.Item>
        <Form.Item label="ข้อมูลแนะนำจากแพทย์" name="doctor_advice" {...fullLayout} style={compactStyle}><Input.TextArea rows={4} placeholder="ข้อมูลคำแนะนำทางการแพทย์ที่ควรทราบ" /></Form.Item>
        <Form.Item label="ข้อมูลรายละเอียดทั่วไป" name="general_notes" {...fullLayout} style={compactStyle}><Input.TextArea rows={4} placeholder="ข้อมูลรายละเอียดทั่วไปอื่น ๆ" /></Form.Item>
      </Col>
    </Row>
  );
  const tab3 = (
    <Row gutter={24} style={{ flex: 1, paddingTop: 16 }}>
      <Col xs={24} lg={12} style={{ paddingRight: 12 }}>
        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>ข้อมูลครอบครัว</Title>
        <Form.Item label="ชื่อบิดา" name="father_name" {...fullColLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="อาชีพ (บิดา)" name="father_occupation" {...fullColLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="ที่อยู่ (บิดา)" name="father_address" {...fullColLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="ชื่อมารดา" name="mother_name" {...fullColLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="อาชีพ (มารดา)" name="mother_occupation" {...fullColLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="ที่อยู่ (มารดา)" name="mother_address" {...fullColLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="จำนวนพี่น้อง" name="siblings_count" {...fullColLayout} style={compactStyle}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="เป็นบุตรคนที่" name="birth_order" {...fullColLayout} style={compactStyle}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
      </Col>
      <Col xs={24} lg={12} style={{ paddingLeft: 12, borderLeft: '1px solid #f0f0f0' }}>
        <Title level={5} underline style={{ color: '#0916C8', margin: 0 }}>ข้อมูลคู่สมรส</Title>
        <Form.Item label="ชื่อคู่สมรส" name="spouse_name" {...fullColLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="อาชีพ (คู่สมรส)" name="spouse_occupation" {...fullColLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="รายได้ (คู่สมรส)" name="spouse_income" {...fullColLayout} style={compactStyle}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="ที่ทำงานคู่สมรส" name="spouse_workplace" {...fullColLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="โทรศัพท์คู่สมรส" name="spouse_phone" {...fullColLayout} style={compactStyle}><Input /></Form.Item>
        <Form.Item label="จำนวนบุตร (รวม)" name="children_total_count" {...fullColLayout} style={compactStyle}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="ยังไม่ศึกษา" name="children_count_pre_school" {...fullColLayout} style={compactStyle}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="กำลังศึกษา" name="children_count_studying" {...fullColLayout} style={compactStyle}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="จบการศึกษา" name="children_count_graduated" {...fullColLayout} style={compactStyle}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
      </Col>
    </Row>
  );

  // ✅ Tab 4: Work History (ปรับปรุงให้เรียก Modal เดียว)
  const tab4 = (
    <TabWorkhistory
      workHistory={workHistory.rows}
      loading={workHistory.loading}
      onCreate={() => {
        if (employee?.employee_id) {
          setCurrentWh(null); // null = Create
          setWhFormOpen(true);
        } else {
          message.error('ไม่พบรหัสพนักงาน');
        }
      }}
      onEdit={(record) => {
        const whId = record?.wh_id || record?.id;
        if (!whId) { message.error('รายการนี้ไม่มีหมายเลขประวัติ (wh_id)'); return; }
        setCurrentWh({ ...record, wh_id: whId }); // object = Edit
        setWhFormOpen(true);
      }}
    />
  );

  // ✅ Tab 5: Relatives (เหมือนเดิม ใช้ Single Modal)
  const tab5 = (
    <TabRelatives
      relatives={relatives.rows}
      loading={relatives.loading}
      onCreate={() => {
        if (employee?.employee_id) {
          setCurrentRelative(null); // null = Create Mode
          setRelativesFormOpen(true);
        } else {
          message.error('ไม่พบรหัสพนักงาน');
        }
      }}
      onEdit={(record) => {
        if (!record?.g_id) { message.error('รายการนี้ไม่มี g_id'); return; }
        setCurrentRelative(record); // record = Edit Mode
        setRelativesFormOpen(true);
      }}
    />
  );

  const tab6 = (
    <div style={{ marginTop: 16 }}>
      <ModalEmployeeWorkReport employeeId={employee?.employee_id} />
    </div>
  );

  const items = [
    { key: '1', label: isEdit ? 'ข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่', children: tab1 },
    { key: '2', label: 'ข้อมูลเพิ่มเติม', children: tab2 },
  ];

  if (isEdit) {
    items.push(
      { key: '3', label: 'ข้อมูลครอบครัว', children: tab3 },
      { key: '4', label: 'ข้อมูลประวัติการทำงาน', children: tab4 },
      { key: '5', label: 'ข้อมูลญาติหรือบุคคลที่สามารถติดต่อได้', children: tab5 },
      { key: '6', label: 'รายงานการทำงานของพนักงาน', children: tab6 }
    );
  }

  return (
    <>
      <Form form={form} layout="horizontal" onFinish={onFinish} onValuesChange={onValuesChange} size="small" onFinishFailed={onFinishFailed}>
        <Tabs type="card" activeKey={activeTabKey} onChange={setActiveTabKey} items={items} />

        <Divider />

        {(!isEdit || !['4', '5'].includes(activeTabKey)) && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button type="primary" htmlType="submit" loading={submitting} disabled={codeDup || hasInvalid}>
              {isEdit ? 'อัปเดต' : 'บันทึก'}
            </Button>
            <Button onClick={onClose}>ยกเลิก</Button>
          </div>
        )}
      </Form>

      <Modallocation open={locationOpen} onClose={() => setLocationOpen(false)} onSelect={handlePickLocation} />

      {isEdit && (
        <>
          {/* ✅ 1. ModalWorkHistoryForm (ตัวใหม่ รวมเพิ่ม/แก้ไข) */}
          <ModalWorkHistoryForm
            open={whFormOpen}
            onClose={() => { setWhFormOpen(false); setCurrentWh(null); }}
            onSuccess={() => { setWhFormOpen(false); setCurrentWh(null); loadWorkHistory(); }}
            employeeId={employee?.employee_id}
            employeeCode={form.getFieldValue('employee_code') || ''}
            record={currentWh} // ส่งไปเพื่อบอก Mode
          />

          {/* ✅ 2. ModalRelativesForm (ตัวเดิมที่รวมแล้ว) */}
          <ModalRelativesForm
            open={relativesFormOpen}
            onClose={() => { setRelativesFormOpen(false); setCurrentRelative(null); }}
            onSuccess={() => { setRelativesFormOpen(false); setCurrentRelative(null); loadRelatives(); }}
            employeeId={employee?.employee_id}
            employeeCode={form.getFieldValue('employee_code') || ''}
            record={currentRelative}
          />
        </>
      )}
    </>
  );
}