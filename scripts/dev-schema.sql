--
-- PostgreSQL database dump
--

\restrict UmXaojvgJ2CHsBegf1Cg8Iew9HfPxeBmc4kMdYd6KaD6PU8UE4fHyRMSUQfMmL5

-- Dumped from database version 14.19 (Homebrew)
-- Dumped by pg_dump version 14.19 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: enum_account_normalBalance; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_account_normalBalance" AS ENUM (
    'debit',
    'credit'
);


--
-- Name: enum_account_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_account_type AS ENUM (
    'asset',
    'liability',
    'equity',
    'revenue',
    'expense'
);


--
-- Name: enum_cash_register_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_cash_register_status AS ENUM (
    'open',
    'closed'
);


--
-- Name: enum_dead_stock_alert_alert_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_dead_stock_alert_alert_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


--
-- Name: enum_dead_stock_alert_alert_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_dead_stock_alert_alert_status AS ENUM (
    'active',
    'acknowledged',
    'resolved'
);


--
-- Name: enum_discount_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_discount_type AS ENUM (
    'percent',
    'nominal'
);


--
-- Name: enum_expense_paymentMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_expense_paymentMethod" AS ENUM (
    'cash',
    'bank',
    'e-wallet'
);


--
-- Name: enum_expense_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_expense_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'draft'
);


--
-- Name: enum_goods_receipt_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_goods_receipt_status AS ENUM (
    'draft',
    'completed',
    'cancelled'
);


--
-- Name: enum_goods_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_goods_request_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


--
-- Name: enum_inventory_valuation_cogs_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_inventory_valuation_cogs_method AS ENUM (
    'FIFO',
    'LIFO',
    'WEIGHTED_AVERAGE',
    'SPECIFIC_ID'
);


--
-- Name: enum_inventory_valuation_valuation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_inventory_valuation_valuation_type AS ENUM (
    'periodic',
    'perpetual'
);


--
-- Name: enum_order_discountType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_order_discountType" AS ENUM (
    'none',
    'percent',
    'nominal'
);


--
-- Name: enum_order_item_discountType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_order_item_discountType" AS ENUM (
    'none',
    'percent',
    'nominal'
);


--
-- Name: enum_order_item_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_order_item_status AS ENUM (
    'pending',
    'preparing',
    'ready',
    'served'
);


--
-- Name: enum_order_paymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_order_paymentStatus" AS ENUM (
    'unpaid',
    'partial',
    'paid',
    'refunded'
);


--
-- Name: enum_order_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_order_source AS ENUM (
    'pos',
    'online',
    'qr',
    'waiter'
);


--
-- Name: enum_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_order_status AS ENUM (
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'served',
    'paid',
    'cancelled',
    'void'
);


--
-- Name: enum_product_batch_quality_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_product_batch_quality_status AS ENUM (
    'passed',
    'failed',
    'pending'
);


--
-- Name: enum_product_batch_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_product_batch_status AS ENUM (
    'active',
    'quarantine',
    'recalled',
    'disposed'
);


--
-- Name: enum_production_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_production_order_status AS ENUM (
    'draft',
    'planned',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: enum_promo_campaign_applicableTo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_promo_campaign_applicableTo" AS ENUM (
    'all',
    'specific_products',
    'specific_categories',
    'specific_members'
);


--
-- Name: enum_promo_campaign_discountType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_promo_campaign_discountType" AS ENUM (
    'percentage',
    'fixed',
    'free_item',
    'buy_x_get_y'
);


--
-- Name: enum_promo_campaign_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_promo_campaign_status AS ENUM (
    'draft',
    'active',
    'paused',
    'expired',
    'cancelled'
);


--
-- Name: enum_promo_campaign_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_promo_campaign_type AS ENUM (
    'happy_hour',
    'birthday',
    'buy_x_get_y',
    'spend_get',
    'manual',
    'automatic'
);


--
-- Name: enum_promo_reward_rewardType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_promo_reward_rewardType" AS ENUM (
    'discount_percentage',
    'discount_fixed',
    'free_item',
    'buy_x_get_y',
    'points_multiplier',
    'cashback'
);


--
-- Name: enum_promo_rule_ruleType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_promo_rule_ruleType" AS ENUM (
    'time',
    'birthday',
    'buy_x_get_y',
    'spend_threshold',
    'member_tier',
    'first_purchase',
    'custom'
);


--
-- Name: enum_purchase_order_paymentMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_purchase_order_paymentMethod" AS ENUM (
    'cash',
    'credit'
);


--
-- Name: enum_purchase_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_purchase_order_status AS ENUM (
    'draft',
    'pending',
    'ordered',
    'received',
    'cancelled'
);


--
-- Name: enum_purchase_return_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_purchase_return_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: enum_queue_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_queue_priority AS ENUM (
    'normal',
    'vip',
    'elderly',
    'pregnant',
    'disabled'
);


--
-- Name: enum_queue_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_queue_status AS ENUM (
    'waiting',
    'seated',
    'cancelled',
    'no_show',
    'expired'
);


--
-- Name: enum_reservation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_reservation_status AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'completed',
    'no_show'
);


--
-- Name: enum_role_roleType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_role_roleType" AS ENUM (
    'super_admin',
    'admin',
    'user',
    'kasir'
);


--
-- Name: enum_sales_return_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_sales_return_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: enum_split_bill_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_split_bill_status AS ENUM (
    'pending',
    'paid'
);


--
-- Name: enum_stock_history_referenceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_stock_history_referenceType" AS ENUM (
    'purchase',
    'sale',
    'adjustment',
    'opname',
    'purchase_return',
    'sale_return',
    'transfer',
    'production',
    'sale_return_reversal',
    'sale_reversal',
    'production_reversal',
    'reconcile',
    'writeoff'
);


--
-- Name: enum_stock_opname_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_stock_opname_status AS ENUM (
    'draft',
    'completed',
    'cancelled'
);


--
-- Name: enum_stock_transfer_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_stock_transfer_status AS ENUM (
    'sent',
    'received',
    'cancelled',
    'pending',
    'approved',
    'rejected'
);


--
-- Name: enum_supplier_score_grade; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_supplier_score_grade AS ENUM (
    'A',
    'B',
    'C',
    'D',
    'F'
);


--
-- Name: enum_supplier_score_period; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_supplier_score_period AS ENUM (
    'monthly',
    'quarterly',
    'yearly',
    'all_time'
);


--
-- Name: enum_table_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_table_status AS ENUM (
    'available',
    'occupied',
    'reserved',
    'maintenance'
);


--
-- Name: enum_tax_config_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_tax_config_type AS ENUM (
    'percentage',
    'fixed',
    'ppn',
    'service_charge',
    'other'
);


--
-- Name: enum_type_payment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_type_payment_type AS ENUM (
    'cash',
    'debit',
    'credit',
    'e-wallet',
    'other'
);


--
-- Name: enum_user_roleType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_user_roleType" AS ENUM (
    'super_admin',
    'admin',
    'kasir',
    'user'
);


--
-- Name: enum_waiter_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_waiter_request_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'done'
);


--
-- Name: enum_waiter_request_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_waiter_request_type AS ENUM (
    'sendok',
    'tisu',
    'refill',
    'bill',
    'call'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id integer NOT NULL,
    store integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    type public.enum_account_type NOT NULL,
    "normalBalance" public."enum_account_normalBalance" NOT NULL,
    "parentId" integer,
    description text,
    "isSystem" boolean DEFAULT false,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_id_seq OWNED BY public.account.id;


--
-- Name: accounting_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_outbox (
    id integer NOT NULL,
    "jobType" character varying(50) NOT NULL,
    store integer,
    "referenceType" character varying(50),
    "referenceId" integer,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "lastError" text,
    "postedAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: accounting_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounting_outbox_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounting_outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounting_outbox_id_seq OWNED BY public.accounting_outbox.id;


--
-- Name: accounts_receivable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_receivable (
    id integer NOT NULL,
    store integer,
    "orderId" integer NOT NULL,
    "customerId" integer,
    "customerName" character varying(255),
    "invoiceNo" character varying(255),
    "invoiceDate" date,
    "dueDate" date,
    "creditTerm" character varying(255),
    "totalAmount" integer DEFAULT 0,
    "paidAmount" integer DEFAULT 0,
    "outstandingAmount" integer DEFAULT 0,
    status character varying(20) DEFAULT 'UNPAID'::character varying,
    notes text,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: accounts_receivable_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_receivable_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_receivable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_receivable_id_seq OWNED BY public.accounts_receivable.id;


--
-- Name: ar_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_payment (
    id integer NOT NULL,
    "arId" integer NOT NULL,
    amount integer DEFAULT 0,
    "paymentDate" date,
    "paymentMethod" character varying(255),
    reference character varying(255),
    notes text,
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: ar_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ar_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ar_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ar_payment_id_seq OWNED BY public.ar_payment.id;


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    store integer,
    "shiftId" integer,
    type character varying(20) DEFAULT 'check-in'::character varying,
    "absenAt" timestamp with time zone,
    latitude double precision,
    longitude double precision,
    accuracy double precision,
    algorithm character varying(20) DEFAULT 'gps'::character varying,
    status character varying(20) DEFAULT 'valid'::character varying,
    note character varying(255),
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- Name: auditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."auditLog" (
    id integer NOT NULL,
    store integer,
    "userId" integer,
    "userName" character varying(100),
    action character varying(20) NOT NULL,
    entity character varying(50) NOT NULL,
    "entityId" integer,
    description text,
    "oldValues" jsonb,
    "newValues" jsonb,
    "ipAddress" character varying(45),
    "userAgent" text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone
);


--
-- Name: auditLog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."auditLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."auditLog_id_seq" OWNED BY public."auditLog".id;


--
-- Name: best_selling; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.best_selling (
    id integer NOT NULL,
    store integer,
    "productId" bigint,
    "nameProduct" character varying(255) NOT NULL,
    image character varying(255),
    "totalSelling" bigint,
    "createdBy" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: best_selling_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.best_selling_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: best_selling_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.best_selling_id_seq OWNED BY public.best_selling.id;


--
-- Name: bom_header; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_header (
    id integer NOT NULL,
    store integer,
    "productId" integer NOT NULL,
    name character varying(255),
    "totalQty" integer DEFAULT 0,
    notes text,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: bom_header_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bom_header_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bom_header_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bom_header_id_seq OWNED BY public.bom_header.id;


--
-- Name: bom_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_line (
    id integer NOT NULL,
    "bomHeaderId" integer NOT NULL,
    "ingredientId" integer NOT NULL,
    qty integer DEFAULT 0,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    notes text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: bom_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bom_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bom_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bom_line_id_seq OWNED BY public.bom_line.id;


--
-- Name: business_trip; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_trip (
    id integer NOT NULL,
    "tripNumber" character varying(255) NOT NULL,
    store integer,
    "employeeId" integer,
    "employeeName" character varying(255),
    "employeePosition" character varying(255),
    destination character varying(255),
    "tripPurpose" text,
    "departureDate" date,
    "returnDate" date,
    budget numeric(15,2),
    notes text,
    status character varying(20) DEFAULT 'draft'::character varying,
    "approvedBy" integer,
    "approvedAt" timestamp with time zone,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: business_trip_budget_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_trip_budget_item (
    id integer NOT NULL,
    "tripId" integer NOT NULL,
    komponen character varying(255),
    qty numeric(15,2),
    satuan character varying(255),
    tarif numeric(15,2),
    total numeric(15,2),
    catatan character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: business_trip_budget_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.business_trip_budget_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: business_trip_budget_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.business_trip_budget_item_id_seq OWNED BY public.business_trip_budget_item.id;


--
-- Name: business_trip_employee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_trip_employee (
    id integer NOT NULL,
    "tripId" integer NOT NULL,
    "employeeId" integer,
    "employeeName" character varying(255),
    "employeePosition" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: business_trip_employee_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.business_trip_employee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: business_trip_employee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.business_trip_employee_id_seq OWNED BY public.business_trip_employee.id;


--
-- Name: business_trip_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.business_trip_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: business_trip_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.business_trip_id_seq OWNED BY public.business_trip.id;


--
-- Name: cash_register; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_register (
    id integer NOT NULL,
    store integer,
    "user" integer NOT NULL,
    shift integer,
    "openingBalance" integer DEFAULT 0,
    "closingBalance" integer DEFAULT 0,
    "totalSales" integer DEFAULT 0,
    "totalExpenses" integer DEFAULT 0,
    "totalPayments" jsonb DEFAULT '{}'::jsonb,
    status public.enum_cash_register_status DEFAULT 'open'::public.enum_cash_register_status,
    "openedAt" timestamp with time zone,
    "closedAt" timestamp with time zone,
    notes text,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: cash_register_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_register_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_register_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_register_id_seq OWNED BY public.cash_register.id;


--
-- Name: category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    value character varying(255),
    image character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" character varying(255),
    "modifiedBy" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "parentId" integer,
    color character varying(20) DEFAULT '#0f172a'::character varying,
    "sortOrder" integer DEFAULT 0
);


--
-- Name: category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.category_id_seq OWNED BY public.category.id;


--
-- Name: category_sales_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_sales_summary (
    id integer NOT NULL,
    store integer NOT NULL,
    category integer NOT NULL,
    report_date date NOT NULL,
    quantity_sold integer,
    revenue numeric(15,2),
    cost numeric(15,2),
    profit numeric(15,2),
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);


--
-- Name: category_sales_summary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.category_sales_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: category_sales_summary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.category_sales_summary_id_seq OWNED BY public.category_sales_summary.id;


--
-- Name: category_store; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_store (
    id integer NOT NULL,
    category integer NOT NULL,
    store integer NOT NULL,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: category_store_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.category_store_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: category_store_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.category_store_id_seq OWNED BY public.category_store.id;


--
-- Name: checkout; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout (
    id integer NOT NULL,
    store integer,
    invoice character varying(255),
    "dateOrder" timestamp with time zone,
    "totalPrice" integer,
    "cashierName" character varying(255),
    "customerName" character varying(255),
    "customerPhoneNumber" character varying(255),
    "totalQuantity" bigint,
    "typePayment" character varying(255),
    "createdBy" character varying(255),
    "modifiedBy" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: checkout_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checkout_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checkout_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checkout_id_seq OWNED BY public.checkout.id;


--
-- Name: currency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.currency (
    id integer NOT NULL,
    store integer,
    code character varying(10) NOT NULL,
    name character varying(50) NOT NULL,
    symbol character varying(10) NOT NULL,
    "exchangeRate" numeric(18,6) DEFAULT 1 NOT NULL,
    "isDefault" boolean DEFAULT false,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: currency_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.currency_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: currency_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.currency_id_seq OWNED BY public.currency.id;


--
-- Name: daily_report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_report (
    id integer NOT NULL,
    store integer,
    tanggal date NOT NULL,
    sesi character varying(20),
    "totalTransaksi" integer DEFAULT 0,
    "totalPenjualanBersih" numeric(15,2) DEFAULT 0,
    "totalHpp" numeric(15,2) DEFAULT 0,
    "foodCostPersen" numeric(5,2) DEFAULT 0,
    "grossProfit" numeric(15,2) DEFAULT 0,
    "grossMarginPersen" numeric(5,2) DEFAULT 0,
    "totalBiayaOperasional" numeric(15,2) DEFAULT 0,
    "netProfit" numeric(15,2) DEFAULT 0,
    "netMarginPersen" numeric(5,2) DEFAULT 0,
    "totalCovers" integer DEFAULT 0,
    "avgSpendingPerCover" numeric(15,2) DEFAULT 0,
    "totalItemVoid" integer DEFAULT 0,
    "totalNilaiVoid" numeric(15,2) DEFAULT 0,
    "penjualanTunai" numeric(15,2) DEFAULT 0,
    "penjualanQris" numeric(15,2) DEFAULT 0,
    "penjualanTransfer" numeric(15,2) DEFAULT 0,
    "saldoKasAwal" numeric(15,2) DEFAULT 0,
    "saldoKasAkhirSistem" numeric(15,2) DEFAULT 0,
    "saldoKasAkhirFisik" numeric(15,2) DEFAULT 0,
    "selisihKas" numeric(15,2) DEFAULT 0,
    "statusFoodCost" character varying(20),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: daily_report_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_report_id_seq OWNED BY public.daily_report.id;


--
-- Name: daily_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_summary (
    id integer NOT NULL,
    store integer,
    date date NOT NULL,
    "totalRevenue" integer DEFAULT 0,
    "totalCost" integer DEFAULT 0,
    "grossProfit" integer DEFAULT 0,
    "totalExpenses" integer DEFAULT 0,
    "netProfit" integer DEFAULT 0,
    "totalOrders" integer DEFAULT 0,
    "totalItemsSold" integer DEFAULT 0,
    "paymentBreakdown" jsonb DEFAULT '{}'::jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: daily_summary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_summary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_summary_id_seq OWNED BY public.daily_summary.id;


--
-- Name: db_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.db_backup (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    filepath character varying(255) NOT NULL,
    size bigint DEFAULT 0,
    format character varying(20) DEFAULT 'custom'::character varying,
    status character varying(20) DEFAULT 'success'::character varying,
    trigger character varying(20) DEFAULT 'manual'::character varying,
    store integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: db_backup_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.db_backup_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: db_backup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.db_backup_id_seq OWNED BY public.db_backup.id;


--
-- Name: dead_stock_alert; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dead_stock_alert (
    id integer NOT NULL,
    product integer NOT NULL,
    store integer NOT NULL,
    quantity integer NOT NULL,
    days_without_sale integer NOT NULL,
    last_sale_date date,
    alert_level public.enum_dead_stock_alert_alert_level DEFAULT 'medium'::public.enum_dead_stock_alert_alert_level NOT NULL,
    alert_status public.enum_dead_stock_alert_alert_status DEFAULT 'active'::public.enum_dead_stock_alert_alert_status NOT NULL,
    notes text,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: dead_stock_alert_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dead_stock_alert_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dead_stock_alert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dead_stock_alert_id_seq OWNED BY public.dead_stock_alert.id;


--
-- Name: delivery_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_order (
    id integer NOT NULL,
    "orderNumber" character varying(255) NOT NULL,
    "order" integer,
    store integer,
    "driverId" integer,
    "driverName" character varying(255),
    "customerName" character varying(255),
    "customerPhone" character varying(255),
    "deliveryAddress" text,
    "deliveryNotes" text,
    "destinationLat" numeric(10,7),
    "destinationLng" numeric(10,7),
    status character varying(20) DEFAULT 'pending'::character varying,
    "estimatedDeliveryTime" timestamp with time zone,
    "actualDeliveryTime" timestamp with time zone,
    "deliveryFee" integer DEFAULT 0,
    "totalDistance" numeric(8,2),
    source character varying(20) DEFAULT 'pos'::character varying,
    "cancellationReason" text,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: delivery_order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: delivery_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_order_id_seq OWNED BY public.delivery_order.id;


--
-- Name: delivery_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_status_history (
    id integer NOT NULL,
    "deliveryOrder" integer NOT NULL,
    status character varying(20) NOT NULL,
    notes text,
    "changedBy" integer,
    "changedByName" character varying(255),
    "locationLat" numeric(10,7),
    "locationLng" numeric(10,7),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: delivery_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: delivery_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_status_history_id_seq OWNED BY public.delivery_status_history.id;


--
-- Name: department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: department_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.department_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.department_id_seq OWNED BY public.department.id;


--
-- Name: discount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    type public.enum_discount_type DEFAULT 'percent'::public.enum_discount_type NOT NULL,
    value integer NOT NULL,
    "minimumOrder" integer DEFAULT 0,
    "maximumDiscount" integer DEFAULT 0,
    "startDate" timestamp with time zone,
    "endDate" timestamp with time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    code character varying(50),
    conditions jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: discount_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discount_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discount_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discount_id_seq OWNED BY public.discount.id;


--
-- Name: driver; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver (
    id integer NOT NULL,
    store jsonb,
    name character varying(255) NOT NULL,
    phone character varying(255),
    email character varying(255),
    "vehicleType" character varying(255),
    "vehiclePlate" character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    "currentLat" numeric(10,7),
    "currentLng" numeric(10,7),
    notes text,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: driver_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.driver_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: driver_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.driver_id_seq OWNED BY public.driver.id;


--
-- Name: expense; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense (
    id integer NOT NULL,
    store integer,
    "expenseNumber" character varying(255) NOT NULL,
    category integer,
    description text,
    amount integer,
    date timestamp with time zone NOT NULL,
    "paymentMethod" public."enum_expense_paymentMethod" DEFAULT 'cash'::public."enum_expense_paymentMethod",
    status public.enum_expense_status DEFAULT 'pending'::public.enum_expense_status,
    notes text,
    receipt character varying(255),
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    frequency character varying(20),
    "parentId" integer,
    "nextDueDate" timestamp with time zone,
    "recurringEndDate" timestamp with time zone,
    payee character varying(255),
    "employeeId" integer,
    "isPaid" boolean DEFAULT false NOT NULL,
    "paidAt" timestamp with time zone,
    "isActive" boolean DEFAULT true NOT NULL
);


--
-- Name: expense_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_category (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    description text,
    icon character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "accountCode" character varying(20)
);


--
-- Name: expense_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expense_category_id_seq OWNED BY public.expense_category.id;


--
-- Name: expense_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expense_id_seq OWNED BY public.expense.id;


--
-- Name: expense_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_payment (
    id integer NOT NULL,
    "expenseId" integer NOT NULL,
    store integer,
    amount integer DEFAULT 0,
    "paymentDate" timestamp with time zone,
    "paymentMethod" character varying(255),
    note text,
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: expense_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expense_payment_id_seq OWNED BY public.expense_payment.id;


--
-- Name: goods_receipt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt (
    id integer NOT NULL,
    store integer,
    "receiptNumber" character varying(255) NOT NULL,
    "purchaseOrderId" integer NOT NULL,
    "receivedDate" timestamp with time zone,
    status public.enum_goods_receipt_status DEFAULT 'draft'::public.enum_goods_receipt_status,
    notes text,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    pic integer,
    documentation text,
    "suratJalan" character varying(255),
    "taxInvoiceNo" character varying(255),
    "shippingCost" numeric(12,2) DEFAULT 0 NOT NULL
);


--
-- Name: goods_receipt_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goods_receipt_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goods_receipt_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goods_receipt_id_seq OWNED BY public.goods_receipt.id;


--
-- Name: goods_receipt_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_item (
    id integer NOT NULL,
    "goodsReceipt" integer NOT NULL,
    "purchaseOrderItem" integer,
    product integer,
    "qtyReceived" integer DEFAULT 0,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    "conditionNotes" text,
    "ingredientName" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "costPrice" integer DEFAULT 0,
    "landedCost" integer DEFAULT 0,
    "conversionToBase" numeric(10,4) DEFAULT 1,
    "qtyStock" numeric(12,2) DEFAULT 0,
    "batchNumber" character varying(255),
    "expiryDate" date
);


--
-- Name: goods_receipt_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goods_receipt_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goods_receipt_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goods_receipt_item_id_seq OWNED BY public.goods_receipt_item.id;


--
-- Name: goods_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_request (
    id integer NOT NULL,
    "requestNumber" character varying(255) NOT NULL,
    store integer,
    status public.enum_goods_request_status DEFAULT 'pending'::public.enum_goods_request_status,
    "requestedBy" character varying(255),
    notes text,
    "approvedBy" integer,
    "approvedAt" timestamp with time zone,
    "purchaseOrderId" integer,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone,
    "requestDate" date,
    "neededDate" date
);


--
-- Name: goods_request_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goods_request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goods_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goods_request_id_seq OWNED BY public.goods_request.id;


--
-- Name: goods_request_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_request_item (
    id integer NOT NULL,
    "goodsRequest" integer NOT NULL,
    product integer,
    "productName" character varying(255),
    ingredient integer,
    "ingredientName" character varying(255),
    supplier integer,
    qty integer NOT NULL,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    notes text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: goods_request_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goods_request_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goods_request_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goods_request_item_id_seq OWNED BY public.goods_request_item.id;


--
-- Name: ingredient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredient (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    category integer,
    supplier integer,
    stock integer DEFAULT 0,
    "minStock" integer DEFAULT 0,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    "baseUnit" character varying(20) DEFAULT 'pcs'::character varying,
    "conversionFactor" double precision DEFAULT '1'::double precision,
    "costPrice" integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: ingredient_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredient_category (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: ingredient_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingredient_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingredient_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingredient_category_id_seq OWNED BY public.ingredient_category.id;


--
-- Name: ingredient_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingredient_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingredient_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingredient_id_seq OWNED BY public.ingredient.id;


--
-- Name: inventory_valuation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_valuation (
    id integer NOT NULL,
    product integer NOT NULL,
    store integer NOT NULL,
    valuation_date date NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    total_cost numeric(15,2) DEFAULT 0 NOT NULL,
    average_cost numeric(15,2) DEFAULT 0 NOT NULL,
    cogs_method public.enum_inventory_valuation_cogs_method DEFAULT 'FIFO'::public.enum_inventory_valuation_cogs_method NOT NULL,
    valuation_type public.enum_inventory_valuation_valuation_type DEFAULT 'perpetual'::public.enum_inventory_valuation_valuation_type NOT NULL,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: inventory_valuation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_valuation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_valuation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_valuation_id_seq OWNED BY public.inventory_valuation.id;


--
-- Name: invoice_footer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_footer (
    id integer NOT NULL,
    store integer,
    name character varying(255),
    "footerList" text,
    status boolean DEFAULT true,
    "isActive" boolean DEFAULT false,
    "createdBy" character varying(255),
    "modifiedBy" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: invoice_footer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_footer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_footer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_footer_id_seq OWNED BY public.invoice_footer.id;


--
-- Name: invoice_logo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_logo (
    id integer NOT NULL,
    store integer,
    image character varying(255),
    status boolean DEFAULT true,
    "isActive" boolean DEFAULT false,
    "createdBy" character varying(255),
    "modifiedBy" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: invoice_logo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_logo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_logo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_logo_id_seq OWNED BY public.invoice_logo.id;


--
-- Name: invoice_setting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_setting (
    id integer NOT NULL,
    store integer NOT NULL,
    "showStoreName" boolean DEFAULT false,
    "showAddress" boolean DEFAULT false,
    "showMemberInfo" boolean DEFAULT true,
    "showLogo" boolean DEFAULT true,
    logo character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "showSocialMedia" boolean DEFAULT true,
    "socialMediaVisibility" text,
    "addressFieldsVisibility" text,
    "memberFieldsVisibility" text,
    footer character varying(255) DEFAULT NULL::character varying,
    "paperSize" character varying(20) DEFAULT '58mm'::character varying,
    "fontSize" character varying(20) DEFAULT 'normal'::character varying,
    "fontFamily" character varying(30) DEFAULT 'monospace'::character varying,
    "lineSpacing" character varying(20) DEFAULT 'normal'::character varying
);


--
-- Name: invoice_setting_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_setting_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_setting_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_setting_id_seq OWNED BY public.invoice_setting.id;


--
-- Name: invoice_social_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_social_media (
    id integer NOT NULL,
    store integer,
    "socialMediaList" text,
    status boolean DEFAULT true,
    "isActive" boolean DEFAULT false,
    "createdBy" character varying(255),
    "modifiedBy" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: invoice_social_media_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_social_media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_social_media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_social_media_id_seq OWNED BY public.invoice_social_media.id;


--
-- Name: journal_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entry (
    id integer NOT NULL,
    store integer NOT NULL,
    "entryNumber" character varying(50) NOT NULL,
    date date NOT NULL,
    description text,
    "sourceType" character varying(30) DEFAULT 'manual'::character varying,
    "referenceId" integer,
    "totalDebit" numeric(15,2) DEFAULT 0,
    "totalCredit" numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'posted'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: journal_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.journal_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: journal_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.journal_entry_id_seq OWNED BY public.journal_entry.id;


--
-- Name: journal_entry_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entry_line (
    id integer NOT NULL,
    "journalEntry" integer NOT NULL,
    account integer NOT NULL,
    debit numeric(15,2) DEFAULT 0,
    credit numeric(15,2) DEFAULT 0,
    description text,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: journal_entry_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.journal_entry_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: journal_entry_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.journal_entry_line_id_seq OWNED BY public.journal_entry_line.id;


--
-- Name: kasir_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kasir_performance (
    id integer NOT NULL,
    store integer NOT NULL,
    cashier integer NOT NULL,
    report_date date NOT NULL,
    total_sales numeric(15,2),
    transactions integer,
    avg_transaction numeric(15,2),
    items_sold integer,
    accuracy_rate numeric(5,2),
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);


--
-- Name: kasir_performance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kasir_performance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kasir_performance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kasir_performance_id_seq OWNED BY public.kasir_performance.id;


--
-- Name: location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location (
    id integer NOT NULL,
    store integer,
    image character varying(255),
    name character varying(255),
    address character varying(255),
    "detailLocation" character varying(255),
    city character varying(255),
    province character varying(255),
    district character varying(255),
    village character varying(255),
    "postalCode" character varying(255),
    latitude double precision,
    longitude double precision,
    "mainBranch" boolean DEFAULT false,
    description text,
    "openingHours" jsonb,
    "managerName" character varying(255),
    email character varying(255),
    category character varying(255),
    "phoneNumber" character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "socialMedia" jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "dailyTarget" integer DEFAULT 0
);


--
-- Name: location_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.location_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: location_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.location_id_seq OWNED BY public.location.id;


--
-- Name: member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    "phoneNumber" character varying(255) NOT NULL,
    email character varying(255),
    address character varying(255),
    tier integer,
    "totalPoints" integer DEFAULT 0,
    "lifetimePoints" integer DEFAULT 0,
    "dateOfBirth" date,
    gender character varying(255),
    notes text,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: member_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.member_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: member_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.member_id_seq OWNED BY public.member.id;


--
-- Name: member_point_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_point_history (
    id integer NOT NULL,
    member integer NOT NULL,
    "pointsChange" integer NOT NULL,
    "pointsBefore" integer NOT NULL,
    "pointsAfter" integer NOT NULL,
    "transactionId" character varying(255),
    notes text,
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: member_point_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.member_point_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: member_point_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.member_point_history_id_seq OWNED BY public.member_point_history.id;


--
-- Name: member_tier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_tier (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    "minPoints" integer DEFAULT 0,
    "maxPoints" integer DEFAULT 999999,
    "discountPercent" integer DEFAULT 0,
    "pointMultiplier" numeric(3,2) DEFAULT 1,
    benefits jsonb DEFAULT '[]'::jsonb,
    color character varying(255) DEFAULT '#000000'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: member_tier_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.member_tier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: member_tier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.member_tier_id_seq OWNED BY public.member_tier.id;


--
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    id integer NOT NULL,
    store integer,
    type character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    "referenceId" integer,
    "referenceType" character varying(255),
    "isRead" boolean DEFAULT false,
    "createdBy" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_id_seq OWNED BY public.notification.id;


--
-- Name: order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."order" (
    id integer NOT NULL,
    "orderNumber" character varying(255) NOT NULL,
    store integer,
    "tableId" integer,
    "customerId" integer,
    "customerName" character varying(255),
    "customerPhone" character varying(255),
    "discountId" integer,
    "promoCode" character varying(255),
    "cashierId" integer,
    "cashierName" character varying(255),
    status public.enum_order_status DEFAULT 'pending'::public.enum_order_status,
    "subTotal" integer DEFAULT 0,
    "discountType" public."enum_order_discountType" DEFAULT 'none'::public."enum_order_discountType",
    "discountValue" integer DEFAULT 0,
    "discountAmount" integer DEFAULT 0,
    "taxRate" numeric(5,2) DEFAULT 0,
    "taxAmount" integer DEFAULT 0,
    "serviceChargeRate" numeric(5,2) DEFAULT 0,
    "serviceChargeAmount" integer DEFAULT 0,
    "totalQuantity" integer DEFAULT 0,
    "totalPrice" integer DEFAULT 0,
    "paymentMethod" character varying(255),
    "paymentStatus" public."enum_order_paymentStatus" DEFAULT 'unpaid'::public."enum_order_paymentStatus",
    notes text,
    source public.enum_order_source DEFAULT 'pos'::public.enum_order_source,
    "currencyId" integer,
    "currencyCode" character varying(10),
    "exchangeRate" numeric(18,6) DEFAULT 1,
    "createdBy" integer,
    "modifiedBy" integer,
    "totalCovers" integer DEFAULT 0,
    "shiftId" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "promoCampaignId" integer,
    "splitCount" integer,
    "customerNumber" integer,
    session character varying(255),
    "idempotencyKey" character varying(255),
    "publicToken" character varying(64)
);


--
-- Name: order_daily_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_daily_counter (
    store integer NOT NULL,
    "counterDate" date NOT NULL,
    "lastValue" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_id_seq OWNED BY public."order".id;


--
-- Name: order_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_item (
    id integer NOT NULL,
    "order" integer NOT NULL,
    product integer NOT NULL,
    "productName" character varying(255),
    quantity integer NOT NULL,
    price integer NOT NULL,
    "discountType" public."enum_order_item_discountType" DEFAULT 'none'::public."enum_order_item_discountType",
    "discountValue" integer DEFAULT 0,
    "discountAmount" integer DEFAULT 0,
    "totalPrice" integer DEFAULT 0,
    options jsonb DEFAULT '[]'::jsonb,
    modifiers jsonb DEFAULT '[]'::jsonb,
    notes text,
    status public.enum_order_item_status DEFAULT 'pending'::public.enum_order_item_status,
    "createdBy" integer,
    "waktuSiap" timestamp with time zone,
    "urutanSaji" integer DEFAULT 0,
    "hppSnapshot" numeric(15,2),
    "stationDapur" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "bundleId" integer,
    "bundleName" character varying(255)
);


--
-- Name: order_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_item_id_seq OWNED BY public.order_item.id;


--
-- Name: order_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status (
    id integer NOT NULL,
    "order" integer NOT NULL,
    status character varying(255),
    notes text,
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: order_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_status_id_seq OWNED BY public.order_status.id;


--
-- Name: overtime; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime (
    id integer NOT NULL,
    store integer,
    shift_id integer NOT NULL,
    employee_id integer NOT NULL,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration_hours numeric(10,2) DEFAULT 0 NOT NULL,
    note text,
    status character varying(20) DEFAULT 'pending'::character varying,
    "decidedBy" integer,
    "decidedAt" timestamp with time zone,
    status_history jsonb DEFAULT '[]'::jsonb,
    accounting_status character varying(20) DEFAULT 'unposted'::character varying,
    "postedAt" timestamp with time zone,
    "journalId" integer,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: overtime_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.overtime_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: overtime_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.overtime_id_seq OWNED BY public.overtime.id;


--
-- Name: position; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."position" (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    "departmentId" integer,
    description character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: position_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.position_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: position_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.position_id_seq OWNED BY public."position".id;


--
-- Name: price_list_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_list_template (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    description text,
    "isActive" boolean DEFAULT true,
    tiers jsonb DEFAULT '[]'::jsonb,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: price_list_template_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.price_list_template_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: price_list_template_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.price_list_template_id_seq OWNED BY public.price_list_template.id;


--
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product (
    id integer NOT NULL,
    "nameProduct" character varying(255) NOT NULL,
    sku character varying(255),
    image character varying(255),
    barcode character varying(255),
    brand character varying(255),
    category integer NOT NULL,
    description text,
    price integer DEFAULT 0 NOT NULL,
    "costPrice" integer DEFAULT 0,
    "isOption" boolean DEFAULT false,
    options jsonb DEFAULT '[]'::jsonb,
    "hasModifiers" boolean DEFAULT false,
    modifiers jsonb DEFAULT '[]'::jsonb,
    stock integer DEFAULT 0,
    "minStock" integer DEFAULT 0,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    "baseUnit" character varying(20) DEFAULT 'pcs'::character varying,
    "conversionFactor" double precision DEFAULT '1'::double precision,
    status character varying(20) DEFAULT 'active'::character varying,
    "isAvailable" boolean DEFAULT true,
    point integer DEFAULT 0,
    "redeemPoints" integer DEFAULT 0,
    tax jsonb,
    "priceTiers" jsonb DEFAULT '[]'::jsonb,
    "currencyId" integer,
    "currencyCode" character varying(10),
    "createdBy" integer,
    "modifiedBy" integer,
    "tipeProduk" character varying(20) DEFAULT 'menu'::character varying,
    "hppPerPorsi" numeric(15,2) DEFAULT 0,
    "foodCostPersen" numeric(5,2) DEFAULT 0,
    "marginPersen" numeric(5,2) DEFAULT 0,
    "isAvailableHariIni" boolean DEFAULT true,
    composition jsonb DEFAULT '[]'::jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "estimationTime" integer DEFAULT 0,
    images jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT product_stock_non_negative CHECK ((stock >= 0))
);


--
-- Name: product_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_batch (
    id integer NOT NULL,
    product integer NOT NULL,
    "batchCode" character varying(255) NOT NULL,
    "expiryDate" date NOT NULL,
    qty integer NOT NULL,
    store integer,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    received_date date,
    received_quantity integer DEFAULT 0,
    cost_per_unit integer DEFAULT 0,
    supplier integer,
    quality_status public.enum_product_batch_quality_status DEFAULT 'pending'::public.enum_product_batch_quality_status,
    notes text
);


--
-- Name: product_batch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_batch_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_batch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_batch_id_seq OWNED BY public.product_batch.id;


--
-- Name: product_batch_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_batch_stock (
    id integer NOT NULL,
    batch integer NOT NULL,
    store integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    reserved_quantity integer DEFAULT 0 NOT NULL,
    allocated_quantity integer DEFAULT 0 NOT NULL,
    unit_cost numeric(15,2),
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: product_batch_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_batch_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_batch_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_batch_stock_id_seq OWNED BY public.product_batch_stock.id;


--
-- Name: product_bundle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_bundle (
    id integer NOT NULL,
    store jsonb,
    name character varying(255) NOT NULL,
    sku character varying(255),
    description text,
    image character varying(255),
    "bundlePrice" integer DEFAULT 0 NOT NULL,
    "originalPrice" integer DEFAULT 0,
    "discountAmount" integer DEFAULT 0,
    "discountPercentage" numeric(5,2) DEFAULT 0,
    "minQuantity" integer DEFAULT 1,
    "maxQuantity" integer,
    "isAvailable" boolean DEFAULT true,
    status character varying(20) DEFAULT 'active'::character varying,
    "validFrom" timestamp with time zone,
    "validUntil" timestamp with time zone,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: product_bundle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_bundle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_bundle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_bundle_id_seq OWNED BY public.product_bundle.id;


--
-- Name: product_bundle_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_bundle_item (
    id integer NOT NULL,
    "bundleId" integer NOT NULL,
    product integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "unitPrice" integer DEFAULT 0,
    "isOptional" boolean DEFAULT false,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: product_bundle_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_bundle_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_bundle_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_bundle_item_id_seq OWNED BY public.product_bundle_item.id;


--
-- Name: product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_id_seq OWNED BY public.product.id;


--
-- Name: product_review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_review (
    id integer NOT NULL,
    "productId" integer NOT NULL,
    store integer,
    "userName" character varying(100) NOT NULL,
    rating integer NOT NULL,
    comment text,
    "orderId" integer,
    status character varying(20) DEFAULT 'published'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: product_review_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_review_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_review_id_seq OWNED BY public.product_review.id;


--
-- Name: product_sales_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_sales_summary (
    id integer NOT NULL,
    store integer NOT NULL,
    product integer NOT NULL,
    report_date date NOT NULL,
    quantity_sold integer,
    revenue numeric(15,2),
    cost numeric(15,2),
    profit numeric(15,2),
    transactions integer,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);


--
-- Name: product_sales_summary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_sales_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_sales_summary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_sales_summary_id_seq OWNED BY public.product_sales_summary.id;


--
-- Name: product_store; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_store (
    id integer NOT NULL,
    product integer NOT NULL,
    store integer NOT NULL,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: product_store_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_store_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_store_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_store_id_seq OWNED BY public.product_store.id;


--
-- Name: product_store_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_store_price (
    id integer NOT NULL,
    product integer NOT NULL,
    store integer NOT NULL,
    price integer NOT NULL,
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: product_store_price_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_store_price_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_store_price_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_store_price_id_seq OWNED BY public.product_store_price.id;


--
-- Name: product_store_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_store_stock (
    id integer NOT NULL,
    product integer NOT NULL,
    store integer NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    CONSTRAINT product_store_stock_stock_non_negative CHECK ((stock >= 0))
);


--
-- Name: product_store_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_store_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_store_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_store_stock_id_seq OWNED BY public.product_store_stock.id;


--
-- Name: production_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_order (
    id integer NOT NULL,
    store integer,
    "productionNo" character varying(255) NOT NULL,
    "productItemId" integer NOT NULL,
    "plannedQty" integer DEFAULT 0,
    "producedQty" integer DEFAULT 0,
    status public.enum_production_order_status DEFAULT 'draft'::public.enum_production_order_status,
    "scheduledDate" date,
    "completedDate" timestamp with time zone,
    notes text,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: production_order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.production_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: production_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.production_order_id_seq OWNED BY public.production_order.id;


--
-- Name: promo_campaign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_campaign (
    id integer NOT NULL,
    store jsonb,
    name character varying(255) NOT NULL,
    description text,
    code character varying(50),
    type public.enum_promo_campaign_type NOT NULL,
    "discountType" public."enum_promo_campaign_discountType" DEFAULT 'percentage'::public."enum_promo_campaign_discountType",
    "discountValue" integer DEFAULT 0,
    "maxDiscount" integer,
    "minPurchase" integer DEFAULT 0,
    "startDate" timestamp with time zone NOT NULL,
    "endDate" timestamp with time zone NOT NULL,
    "startTime" time without time zone,
    "endTime" time without time zone,
    "daysOfWeek" jsonb,
    "applicableTo" public."enum_promo_campaign_applicableTo" DEFAULT 'all'::public."enum_promo_campaign_applicableTo",
    "applicableIds" jsonb,
    "maxUsageTotal" integer,
    "maxUsagePerMember" integer,
    "currentUsage" integer DEFAULT 0,
    priority integer DEFAULT 0,
    "isCombinable" boolean DEFAULT false,
    status public.enum_promo_campaign_status DEFAULT 'draft'::public.enum_promo_campaign_status,
    "autoActivate" boolean DEFAULT false,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: promo_campaign_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_campaign_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_campaign_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_campaign_id_seq OWNED BY public.promo_campaign.id;


--
-- Name: promo_reward; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_reward (
    id integer NOT NULL,
    "campaignId" integer NOT NULL,
    "rewardType" public."enum_promo_reward_rewardType" NOT NULL,
    "rewardValue" integer NOT NULL,
    "maxRewardValue" integer,
    "productId" integer,
    "productIds" jsonb,
    quantity integer DEFAULT 1,
    condition jsonb,
    "isActive" boolean DEFAULT true,
    priority integer DEFAULT 0,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: promo_reward_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_reward_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_reward_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_reward_id_seq OWNED BY public.promo_reward.id;


--
-- Name: promo_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_rule (
    id integer NOT NULL,
    "campaignId" integer NOT NULL,
    "ruleType" public."enum_promo_rule_ruleType" NOT NULL,
    condition jsonb NOT NULL,
    "isActive" boolean DEFAULT true,
    priority integer DEFAULT 0,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: promo_rule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_rule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_rule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_rule_id_seq OWNED BY public.promo_rule.id;


--
-- Name: promo_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_usage (
    id integer NOT NULL,
    store jsonb,
    "campaignId" integer NOT NULL,
    "orderId" integer,
    "memberId" integer,
    "discountApplied" integer DEFAULT 0,
    "freeItemsGiven" jsonb,
    "pointsMultiplier" integer DEFAULT 1,
    "cashbackAmount" integer DEFAULT 0,
    "appliedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "createdBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: promo_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_usage_id_seq OWNED BY public.promo_usage.id;


--
-- Name: purchase_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order (
    id integer NOT NULL,
    store integer,
    "orderNumber" character varying(255) NOT NULL,
    "totalAmount" integer DEFAULT 0,
    discount integer DEFAULT 0,
    "finalAmount" integer DEFAULT 0,
    status public.enum_purchase_order_status DEFAULT 'pending'::public.enum_purchase_order_status,
    "orderDate" timestamp with time zone,
    "receivedDate" timestamp with time zone,
    notes text,
    "createdBy" integer,
    "modifiedBy" integer,
    pic integer,
    "dueDate" date,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "paymentMethod" public."enum_purchase_order_paymentMethod" DEFAULT 'cash'::public."enum_purchase_order_paymentMethod",
    tenor integer DEFAULT 0,
    "dpPercent" numeric(5,2) DEFAULT 0,
    "additionalCost" integer DEFAULT 0,
    "overDeliveryTolerance" integer DEFAULT 10,
    "additionalCostNotes" character varying(255)
);


--
-- Name: COLUMN purchase_order."additionalCostNotes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.purchase_order."additionalCostNotes" IS 'Keterangan untuk biaya tambahan (misal: ongkir, admin bank)';


--
-- Name: purchase_order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_order_id_seq OWNED BY public.purchase_order.id;


--
-- Name: purchase_order_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_item (
    id integer NOT NULL,
    "purchaseOrder" integer NOT NULL,
    product integer,
    "ingredientName" character varying(255),
    ingredient integer,
    quantity numeric(10,4) NOT NULL,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    price integer NOT NULL,
    total integer DEFAULT 0,
    "receivedQuantity" numeric(10,4) DEFAULT 0,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    supplier integer,
    "conversionToBase" numeric(10,4) DEFAULT 1
);


--
-- Name: purchase_order_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_order_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_order_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_order_item_id_seq OWNED BY public.purchase_order_item.id;


--
-- Name: purchase_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_payment (
    id integer NOT NULL,
    store integer,
    "purchaseOrder" integer NOT NULL,
    supplier integer NOT NULL,
    "paymentDate" date,
    amount integer DEFAULT 0,
    "paymentMethod" character varying(255),
    reference character varying(255),
    notes text,
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "idempotencyKey" character varying(255)
);


--
-- Name: purchase_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_payment_id_seq OWNED BY public.purchase_payment.id;


--
-- Name: purchase_return; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_return (
    id integer NOT NULL,
    "purchaseOrder" integer NOT NULL,
    store integer NOT NULL,
    "returnNumber" character varying(255) NOT NULL,
    status public.enum_purchase_return_status DEFAULT 'pending'::public.enum_purchase_return_status,
    reason text,
    "returnedBy" character varying(255),
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    resolution character varying(255),
    documentation text
);


--
-- Name: purchase_return_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_return_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_return_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_return_id_seq OWNED BY public.purchase_return.id;


--
-- Name: purchase_return_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_return_item (
    id integer NOT NULL,
    "purchaseReturn" integer NOT NULL,
    product integer,
    ingredient integer,
    qty integer NOT NULL,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    notes text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "ingredientName" text
);


--
-- Name: purchase_return_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_return_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_return_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_return_item_id_seq OWNED BY public.purchase_return_item.id;


--
-- Name: queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue (
    id integer NOT NULL,
    store jsonb,
    "queueNumber" character varying(20) NOT NULL,
    "customerName" character varying(255) NOT NULL,
    "customerPhone" character varying(255),
    "partySize" integer DEFAULT 1 NOT NULL,
    priority public.enum_queue_priority DEFAULT 'normal'::public.enum_queue_priority,
    "estimatedWaitMinutes" integer,
    "actualWaitMinutes" integer,
    "tableId" integer,
    notes text,
    status public.enum_queue_status DEFAULT 'waiting'::public.enum_queue_status,
    "checkedInAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "seatedAt" timestamp with time zone,
    "cancelledAt" timestamp with time zone,
    "assignedTo" integer,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.queue_id_seq OWNED BY public.queue.id;


--
-- Name: region; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.region (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    level character varying(10) NOT NULL,
    "parentCode" character varying(20),
    "postalCode" character varying(10),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    latitude double precision,
    longitude double precision
);


--
-- Name: region_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.region_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: region_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.region_id_seq OWNED BY public.region.id;


--
-- Name: report_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_config (
    id integer NOT NULL,
    key character varying(255) NOT NULL,
    config jsonb NOT NULL,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: report_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: report_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_config_id_seq OWNED BY public.report_config.id;


--
-- Name: reservation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation (
    id integer NOT NULL,
    store integer,
    "tableId" integer,
    "customerName" character varying(255) NOT NULL,
    "customerPhone" character varying(255),
    "customerEmail" character varying(255),
    "guestCount" integer DEFAULT 1,
    "reservationDate" date NOT NULL,
    "startTime" time without time zone NOT NULL,
    "endTime" time without time zone,
    notes text,
    status public.enum_reservation_status DEFAULT 'pending'::public.enum_reservation_status,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: reservation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reservation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reservation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reservation_id_seq OWNED BY public.reservation.id;


--
-- Name: role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    "roleType" public."enum_role_roleType" DEFAULT 'user'::public."enum_role_roleType",
    "accessMenu" jsonb DEFAULT '[]'::jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "isSystem" boolean DEFAULT false NOT NULL
);


--
-- Name: role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_id_seq OWNED BY public.role.id;


--
-- Name: sales_return; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_return (
    id integer NOT NULL,
    "order" integer NOT NULL,
    store integer NOT NULL,
    "returnNumber" character varying(255) NOT NULL,
    status public.enum_sales_return_status DEFAULT 'pending'::public.enum_sales_return_status,
    reason text,
    "returnedBy" integer,
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "refundAmount" integer DEFAULT 0,
    "refundMethod" character varying(255) DEFAULT 'cash'::character varying NOT NULL
);


--
-- Name: sales_return_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_return_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_return_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_return_id_seq OWNED BY public.sales_return.id;


--
-- Name: sales_return_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_return_item (
    id integer NOT NULL,
    "salesReturn" integer NOT NULL,
    product integer NOT NULL,
    qty integer NOT NULL,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    notes text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "orderItem" integer,
    price integer DEFAULT 0,
    "conversionToBase" numeric(10,4) DEFAULT 1
);


--
-- Name: sales_return_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_return_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_return_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_return_item_id_seq OWNED BY public.sales_return_item.id;


--
-- Name: sales_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_summary (
    id integer NOT NULL,
    store integer NOT NULL,
    report_date date NOT NULL,
    total_sales numeric(15,2),
    total_transactions integer,
    total_items integer,
    average_transaction numeric(15,2),
    total_discount numeric(15,2),
    total_tax numeric(15,2),
    payment_cash numeric(15,2),
    payment_card numeric(15,2),
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);


--
-- Name: sales_summary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_summary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_summary_id_seq OWNED BY public.sales_summary.id;


--
-- Name: scheduler_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduler_lock (
    name character varying(255) NOT NULL,
    "lockedUntil" timestamp with time zone,
    "lockedBy" character varying(255),
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: shift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    "startTime" time without time zone NOT NULL,
    "endTime" time without time zone NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    tipe_shift character varying(20) DEFAULT ''::character varying,
    tanggal_mulai date,
    tanggal_selesai date,
    karyawan jsonb DEFAULT '[]'::jsonb
);


--
-- Name: shift_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shift_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shift_id_seq OWNED BY public.shift.id;


--
-- Name: shift_swap; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_swap (
    id integer NOT NULL,
    store integer,
    "requesterId" integer NOT NULL,
    "targetId" integer NOT NULL,
    "requesterShiftId" integer NOT NULL,
    "targetShiftId" integer NOT NULL,
    tanggal_mulai date,
    tanggal_selesai date,
    note text,
    status character varying(20) DEFAULT 'pending'::character varying,
    "decidedBy" integer,
    "decidedAt" timestamp with time zone,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone,
    status_history jsonb DEFAULT '[]'::jsonb,
    expires_at timestamp without time zone
);


--
-- Name: shift_swap_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shift_swap_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_swap_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shift_swap_id_seq OWNED BY public.shift_swap.id;


--
-- Name: shift_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_template (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    "startTime" time without time zone NOT NULL,
    "endTime" time without time zone NOT NULL,
    description character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: shift_template_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shift_template_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_template_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shift_template_id_seq OWNED BY public.shift_template.id;


--
-- Name: social_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_media (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    icon character varying(255),
    link character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: social_media_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.social_media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: social_media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.social_media_id_seq OWNED BY public.social_media.id;


--
-- Name: split_bill; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.split_bill (
    id integer NOT NULL,
    "order" integer NOT NULL,
    "splitNumber" character varying(255) NOT NULL,
    amount integer NOT NULL,
    status public.enum_split_bill_status DEFAULT 'pending'::public.enum_split_bill_status,
    "paymentMethod" character varying(255),
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: split_bill_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.split_bill_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: split_bill_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.split_bill_id_seq OWNED BY public.split_bill.id;


--
-- Name: station_dapur; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.station_dapur (
    id integer NOT NULL,
    store integer NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: station_dapur_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.station_dapur_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: station_dapur_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.station_dapur_id_seq OWNED BY public.station_dapur.id;


--
-- Name: stock_forecast; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_forecast (
    id integer NOT NULL,
    product integer NOT NULL,
    store integer NOT NULL,
    current_quantity integer DEFAULT 0 NOT NULL,
    daily_consumption_rate numeric(10,4),
    lead_time_days integer,
    safety_stock integer DEFAULT 0,
    reorder_point integer,
    forecasted_stockout_date date,
    forecast_date date NOT NULL,
    confidence_level numeric(5,2),
    notes text,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    days_until_stockout integer,
    last_updated timestamp with time zone DEFAULT now()
);


--
-- Name: stock_forecast_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_forecast_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_forecast_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_forecast_id_seq OWNED BY public.stock_forecast.id;


--
-- Name: stock_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_history (
    id integer NOT NULL,
    store integer,
    product integer,
    "ingredientName" character varying(255),
    "referenceType" public."enum_stock_history_referenceType" NOT NULL,
    "referenceId" integer,
    "quantityBefore" integer DEFAULT 0,
    "quantityChange" integer NOT NULL,
    "quantityAfter" integer NOT NULL,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    notes text,
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    ingredient integer
);


--
-- Name: stock_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_history_id_seq OWNED BY public.stock_history.id;


--
-- Name: stock_opname; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_opname (
    id integer NOT NULL,
    store integer,
    "opnameNumber" character varying(255) NOT NULL,
    date timestamp with time zone NOT NULL,
    "auditDate" date,
    auditor character varying(255),
    "totalAdjustment" integer DEFAULT 0,
    status public.enum_stock_opname_status DEFAULT 'draft'::public.enum_stock_opname_status,
    notes text,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: stock_opname_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_opname_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_opname_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_opname_id_seq OWNED BY public.stock_opname.id;


--
-- Name: stock_opname_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_opname_item (
    id integer NOT NULL,
    "stockOpname" integer NOT NULL,
    "kodeBarang" character varying(255),
    "namaBarang" character varying(255),
    satuan character varying(255),
    "lokasiId" integer,
    lokasi character varying(255),
    "stokAwalJumlah" integer DEFAULT 0,
    "barangMasukJumlah" integer DEFAULT 0,
    "barangKeluarJumlah" integer DEFAULT 0,
    "stokAkhirJumlah" integer DEFAULT 0,
    "stokFisikJumlah" integer DEFAULT 0,
    "selisihJumlah" integer DEFAULT 0,
    product integer,
    "ingredientName" character varying(255),
    "systemStock" integer DEFAULT 0 NOT NULL,
    "actualStock" integer DEFAULT 0 NOT NULL,
    adjustment integer DEFAULT 0,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    notes text,
    keterangan text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: stock_opname_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_opname_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_opname_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_opname_item_id_seq OWNED BY public.stock_opname_item.id;


--
-- Name: stock_transfer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfer (
    id integer NOT NULL,
    "transferNumber" character varying(255) NOT NULL,
    "fromStore" integer NOT NULL,
    "toStore" integer NOT NULL,
    status public.enum_stock_transfer_status DEFAULT 'sent'::public.enum_stock_transfer_status,
    notes text,
    "transferredBy" character varying(255),
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    reason character varying(100) DEFAULT NULL::character varying,
    "expectedArrival" date
);


--
-- Name: stock_transfer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_transfer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_transfer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_transfer_id_seq OWNED BY public.stock_transfer.id;


--
-- Name: stock_transfer_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfer_item (
    id integer NOT NULL,
    "stockTransfer" integer NOT NULL,
    product integer NOT NULL,
    qty integer NOT NULL,
    unit character varying(255) DEFAULT 'pcs'::character varying,
    notes text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: stock_transfer_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_transfer_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_transfer_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_transfer_item_id_seq OWNED BY public.stock_transfer_item.id;


--
-- Name: supplier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier (
    id integer NOT NULL,
    store jsonb,
    name character varying(255) NOT NULL,
    phone character varying(255),
    email character varying(255),
    "contactPerson" character varying(255),
    address text,
    description text,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "paymentType" character varying(10) DEFAULT 'cbd'::character varying,
    "tempoDays" integer DEFAULT 0,
    "categoryId" integer,
    mobile character varying(255),
    whatsapp character varying(255),
    fax character varying(255),
    website character varying(255),
    "taxInclude" boolean DEFAULT true,
    "taxType" character varying(20),
    "taxNumber" character varying(255),
    "taxName" character varying(255),
    nitku character varying(255),
    "taxTransactionType" character varying(20),
    "defaultDiscount" numeric(5,2) DEFAULT 0,
    "defaultDescription" text
);


--
-- Name: supplier_bank_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_bank_account (
    id integer NOT NULL,
    supplier integer NOT NULL,
    "bankName" character varying(255) NOT NULL,
    "accountNumber" character varying(255) NOT NULL,
    "accountName" character varying(255) NOT NULL,
    "isDefault" boolean DEFAULT false,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: supplier_bank_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_bank_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_bank_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_bank_account_id_seq OWNED BY public.supplier_bank_account.id;


--
-- Name: supplier_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_category (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'active'::character varying,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: supplier_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_category_id_seq OWNED BY public.supplier_category.id;


--
-- Name: supplier_contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_contact (
    id integer NOT NULL,
    supplier integer NOT NULL,
    "fullName" character varying(255) NOT NULL,
    "position" character varying(255),
    email character varying(255),
    phone character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: supplier_contact_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_contact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_contact_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_contact_id_seq OWNED BY public.supplier_contact.id;


--
-- Name: supplier_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_id_seq OWNED BY public.supplier.id;


--
-- Name: supplier_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_performance (
    id integer NOT NULL,
    supplier integer NOT NULL,
    month date NOT NULL,
    total_orders integer DEFAULT 0 NOT NULL,
    on_time_deliveries integer DEFAULT 0 NOT NULL,
    late_deliveries integer DEFAULT 0 NOT NULL,
    damaged_items integer DEFAULT 0 NOT NULL,
    correct_items integer DEFAULT 0 NOT NULL,
    avg_lead_time_days numeric(5,2),
    total_value numeric(15,2) DEFAULT 0 NOT NULL,
    total_quantity integer DEFAULT 0 NOT NULL,
    score numeric(5,2),
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: supplier_performance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_performance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_performance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_performance_id_seq OWNED BY public.supplier_performance.id;


--
-- Name: supplier_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_product (
    id integer NOT NULL,
    supplier integer NOT NULL,
    name text NOT NULL,
    price bigint DEFAULT 0,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone,
    "productId" integer,
    "leadTime" integer DEFAULT 0,
    "qualityRating" numeric(5,2) DEFAULT 0,
    "minOrderQty" character varying(50) DEFAULT '1'::character varying,
    "lastPrice" bigint DEFAULT 0,
    unit character varying(20) DEFAULT 'pcs'::character varying,
    "leadTimeUnit" character varying(10) DEFAULT 'hari'::character varying,
    notes text
);


--
-- Name: supplier_product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_product_id_seq OWNED BY public.supplier_product.id;


--
-- Name: supplier_score; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_score (
    id integer NOT NULL,
    store jsonb,
    "supplierId" integer NOT NULL,
    period public.enum_supplier_score_period NOT NULL,
    "periodStart" date,
    "periodEnd" date,
    "totalOrders" integer DEFAULT 0,
    "completedOrders" integer DEFAULT 0,
    "cancelledOrders" integer DEFAULT 0,
    "onTimeDeliveries" integer DEFAULT 0,
    "lateDeliveries" integer DEFAULT 0,
    "onTimeRate" numeric(5,2) DEFAULT 0,
    "totalReceivedQty" integer DEFAULT 0,
    "defectiveQty" integer DEFAULT 0,
    "defectRate" numeric(5,2) DEFAULT 0,
    "totalPurchaseAmount" bigint DEFAULT 0,
    "avgPricePerItem" bigint DEFAULT 0,
    "priceCompetitivenessScore" numeric(5,2) DEFAULT 0,
    "overallScore" numeric(5,2) DEFAULT 0,
    grade public.enum_supplier_score_grade DEFAULT 'F'::public.enum_supplier_score_grade,
    notes text,
    "calculatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: supplier_score_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_score_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_score_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_score_id_seq OWNED BY public.supplier_score.id;


--
-- Name: table; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."table" (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    capacity integer DEFAULT 4,
    status public.enum_table_status DEFAULT 'available'::public.enum_table_status,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    area character varying(20) DEFAULT 'indoor'::character varying,
    "tableType" character varying(20) DEFAULT 'regular'::character varying
);


--
-- Name: table_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.table_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: table_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.table_id_seq OWNED BY public."table".id;


--
-- Name: tax_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_config (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    rate integer DEFAULT 0 NOT NULL,
    type public.enum_tax_config_type DEFAULT 'percentage'::public.enum_tax_config_type,
    status character varying(20) DEFAULT 'active'::character varying,
    description text,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone
);


--
-- Name: tax_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tax_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tax_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tax_config_id_seq OWNED BY public.tax_config.id;


--
-- Name: transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction (
    id integer NOT NULL,
    "order" integer NOT NULL,
    "typePayment" character varying(255) NOT NULL,
    amount integer NOT NULL,
    "cardNumber" character varying(255),
    "cardType" character varying(255),
    "referenceNumber" character varying(255),
    notes text,
    "createdBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "salesReturnId" integer
);


--
-- Name: transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transaction_id_seq OWNED BY public.transaction.id;


--
-- Name: type_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.type_payment (
    id integer NOT NULL,
    store integer,
    name character varying(255) NOT NULL,
    icon character varying(255),
    type public.enum_type_payment_type DEFAULT 'cash'::public.enum_type_payment_type,
    status character varying(20) DEFAULT 'active'::character varying,
    "isSystem" boolean DEFAULT false,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "feeType" character varying(20) DEFAULT 'fixed'::character varying,
    fee numeric(10,2) DEFAULT 0,
    tenor integer DEFAULT 0,
    "sortOrder" integer DEFAULT 0
);


--
-- Name: type_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.type_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: type_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.type_payment_id_seq OWNED BY public.type_payment.id;


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id integer NOT NULL,
    image character varying(255),
    "roleType" public."enum_user_roleType" DEFAULT 'user'::public."enum_user_roleType",
    "roleId" integer,
    "userType" character varying(255),
    "fullName" character varying(255),
    "userName" character varying(255),
    password character varying(255),
    email character varying(255),
    address character varying(255),
    gender character varying(255),
    "phoneNumber" character varying(255),
    "employeeID" character varying(255),
    department character varying(255),
    "departmentId" integer,
    "employmentType" character varying(255),
    "startDate" date,
    status character varying(20) DEFAULT 'active'::character varying,
    "dateOfBirth" date,
    "placeOfBirth" character varying(255),
    store integer,
    shift integer,
    "position" integer,
    "contractDuration" character varying(255),
    "endDate" date,
    "accessMenu" jsonb DEFAULT '[]'::jsonb,
    "monthlySalary" numeric(15,2),
    "dailySalary" numeric(15,2),
    documents text,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "resetToken" character varying(255),
    "resetTokenExpires" timestamp with time zone,
    "overtimeRate" numeric(15,2) DEFAULT 0,
    "overtimeFactor" numeric(10,2) DEFAULT 1.5
);


--
-- Name: user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_id_seq OWNED BY public."user".id;


--
-- Name: waiter_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waiter_request (
    id integer NOT NULL,
    store jsonb,
    "requestNumber" character varying(20) NOT NULL,
    "tableId" integer,
    "orderId" integer,
    type public.enum_waiter_request_type NOT NULL,
    notes text,
    "customerName" character varying(255),
    status public.enum_waiter_request_status DEFAULT 'pending'::public.enum_waiter_request_status,
    "resolvedAt" timestamp with time zone,
    "resolvedBy" integer,
    "createdBy" integer,
    "modifiedBy" integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp with time zone
);


--
-- Name: waiter_request_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.waiter_request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: waiter_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.waiter_request_id_seq OWNED BY public.waiter_request.id;


--
-- Name: account id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account ALTER COLUMN id SET DEFAULT nextval('public.account_id_seq'::regclass);


--
-- Name: accounting_outbox id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_outbox ALTER COLUMN id SET DEFAULT nextval('public.accounting_outbox_id_seq'::regclass);


--
-- Name: accounts_receivable id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_receivable ALTER COLUMN id SET DEFAULT nextval('public.accounts_receivable_id_seq'::regclass);


--
-- Name: ar_payment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_payment ALTER COLUMN id SET DEFAULT nextval('public.ar_payment_id_seq'::regclass);


--
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- Name: auditLog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."auditLog" ALTER COLUMN id SET DEFAULT nextval('public."auditLog_id_seq"'::regclass);


--
-- Name: best_selling id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.best_selling ALTER COLUMN id SET DEFAULT nextval('public.best_selling_id_seq'::regclass);


--
-- Name: bom_header id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_header ALTER COLUMN id SET DEFAULT nextval('public.bom_header_id_seq'::regclass);


--
-- Name: bom_line id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line ALTER COLUMN id SET DEFAULT nextval('public.bom_line_id_seq'::regclass);


--
-- Name: business_trip id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_trip ALTER COLUMN id SET DEFAULT nextval('public.business_trip_id_seq'::regclass);


--
-- Name: business_trip_budget_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_trip_budget_item ALTER COLUMN id SET DEFAULT nextval('public.business_trip_budget_item_id_seq'::regclass);


--
-- Name: business_trip_employee id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_trip_employee ALTER COLUMN id SET DEFAULT nextval('public.business_trip_employee_id_seq'::regclass);


--
-- Name: cash_register id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register ALTER COLUMN id SET DEFAULT nextval('public.cash_register_id_seq'::regclass);


--
-- Name: category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category ALTER COLUMN id SET DEFAULT nextval('public.category_id_seq'::regclass);


--
-- Name: category_sales_summary id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_sales_summary ALTER COLUMN id SET DEFAULT nextval('public.category_sales_summary_id_seq'::regclass);


--
-- Name: category_store id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_store ALTER COLUMN id SET DEFAULT nextval('public.category_store_id_seq'::regclass);


--
-- Name: checkout id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout ALTER COLUMN id SET DEFAULT nextval('public.checkout_id_seq'::regclass);


--
-- Name: currency id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currency ALTER COLUMN id SET DEFAULT nextval('public.currency_id_seq'::regclass);


--
-- Name: daily_report id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_report ALTER COLUMN id SET DEFAULT nextval('public.daily_report_id_seq'::regclass);


--
-- Name: daily_summary id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summary ALTER COLUMN id SET DEFAULT nextval('public.daily_summary_id_seq'::regclass);


--
-- Name: db_backup id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.db_backup ALTER COLUMN id SET DEFAULT nextval('public.db_backup_id_seq'::regclass);


--
-- Name: dead_stock_alert id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dead_stock_alert ALTER COLUMN id SET DEFAULT nextval('public.dead_stock_alert_id_seq'::regclass);


--
-- Name: delivery_order id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_order ALTER COLUMN id SET DEFAULT nextval('public.delivery_order_id_seq'::regclass);


--
-- Name: delivery_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_status_history ALTER COLUMN id SET DEFAULT nextval('public.delivery_status_history_id_seq'::regclass);


--
-- Name: department id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department ALTER COLUMN id SET DEFAULT nextval('public.department_id_seq'::regclass);


--
-- Name: discount id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount ALTER COLUMN id SET DEFAULT nextval('public.discount_id_seq'::regclass);


--
-- Name: driver id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver ALTER COLUMN id SET DEFAULT nextval('public.driver_id_seq'::regclass);


--
-- Name: expense id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense ALTER COLUMN id SET DEFAULT nextval('public.expense_id_seq'::regclass);


--
-- Name: expense_category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_category ALTER COLUMN id SET DEFAULT nextval('public.expense_category_id_seq'::regclass);


--
-- Name: expense_payment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_payment ALTER COLUMN id SET DEFAULT nextval('public.expense_payment_id_seq'::regclass);


--
-- Name: goods_receipt id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt ALTER COLUMN id SET DEFAULT nextval('public.goods_receipt_id_seq'::regclass);


--
-- Name: goods_receipt_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_item ALTER COLUMN id SET DEFAULT nextval('public.goods_receipt_item_id_seq'::regclass);


--
-- Name: goods_request id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request ALTER COLUMN id SET DEFAULT nextval('public.goods_request_id_seq'::regclass);


--
-- Name: goods_request_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request_item ALTER COLUMN id SET DEFAULT nextval('public.goods_request_item_id_seq'::regclass);


--
-- Name: ingredient id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient ALTER COLUMN id SET DEFAULT nextval('public.ingredient_id_seq'::regclass);


--
-- Name: ingredient_category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient_category ALTER COLUMN id SET DEFAULT nextval('public.ingredient_category_id_seq'::regclass);


--
-- Name: inventory_valuation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_valuation ALTER COLUMN id SET DEFAULT nextval('public.inventory_valuation_id_seq'::regclass);


--
-- Name: invoice_footer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_footer ALTER COLUMN id SET DEFAULT nextval('public.invoice_footer_id_seq'::regclass);


--
-- Name: invoice_logo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_logo ALTER COLUMN id SET DEFAULT nextval('public.invoice_logo_id_seq'::regclass);


--
-- Name: invoice_setting id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_setting ALTER COLUMN id SET DEFAULT nextval('public.invoice_setting_id_seq'::regclass);


--
-- Name: invoice_social_media id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_social_media ALTER COLUMN id SET DEFAULT nextval('public.invoice_social_media_id_seq'::regclass);


--
-- Name: journal_entry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry ALTER COLUMN id SET DEFAULT nextval('public.journal_entry_id_seq'::regclass);


--
-- Name: journal_entry_line id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_line ALTER COLUMN id SET DEFAULT nextval('public.journal_entry_line_id_seq'::regclass);


--
-- Name: kasir_performance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kasir_performance ALTER COLUMN id SET DEFAULT nextval('public.kasir_performance_id_seq'::regclass);


--
-- Name: location id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location ALTER COLUMN id SET DEFAULT nextval('public.location_id_seq'::regclass);


--
-- Name: member id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member ALTER COLUMN id SET DEFAULT nextval('public.member_id_seq'::regclass);


--
-- Name: member_point_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_point_history ALTER COLUMN id SET DEFAULT nextval('public.member_point_history_id_seq'::regclass);


--
-- Name: member_tier id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_tier ALTER COLUMN id SET DEFAULT nextval('public.member_tier_id_seq'::regclass);


--
-- Name: notification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification ALTER COLUMN id SET DEFAULT nextval('public.notification_id_seq'::regclass);


--
-- Name: order id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order" ALTER COLUMN id SET DEFAULT nextval('public.order_id_seq'::regclass);


--
-- Name: order_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item ALTER COLUMN id SET DEFAULT nextval('public.order_item_id_seq'::regclass);


--
-- Name: order_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status ALTER COLUMN id SET DEFAULT nextval('public.order_status_id_seq'::regclass);


--
-- Name: overtime id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime ALTER COLUMN id SET DEFAULT nextval('public.overtime_id_seq'::regclass);


--
-- Name: position id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."position" ALTER COLUMN id SET DEFAULT nextval('public.position_id_seq'::regclass);


--
-- Name: price_list_template id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_list_template ALTER COLUMN id SET DEFAULT nextval('public.price_list_template_id_seq'::regclass);


--
-- Name: product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product ALTER COLUMN id SET DEFAULT nextval('public.product_id_seq'::regclass);


--
-- Name: product_batch id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batch ALTER COLUMN id SET DEFAULT nextval('public.product_batch_id_seq'::regclass);


--
-- Name: product_batch_stock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batch_stock ALTER COLUMN id SET DEFAULT nextval('public.product_batch_stock_id_seq'::regclass);


--
-- Name: product_bundle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle ALTER COLUMN id SET DEFAULT nextval('public.product_bundle_id_seq'::regclass);


--
-- Name: product_bundle_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle_item ALTER COLUMN id SET DEFAULT nextval('public.product_bundle_item_id_seq'::regclass);


--
-- Name: product_review id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review ALTER COLUMN id SET DEFAULT nextval('public.product_review_id_seq'::regclass);


--
-- Name: product_sales_summary id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sales_summary ALTER COLUMN id SET DEFAULT nextval('public.product_sales_summary_id_seq'::regclass);


--
-- Name: product_store id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store ALTER COLUMN id SET DEFAULT nextval('public.product_store_id_seq'::regclass);


--
-- Name: product_store_price id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store_price ALTER COLUMN id SET DEFAULT nextval('public.product_store_price_id_seq'::regclass);


--
-- Name: product_store_stock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store_stock ALTER COLUMN id SET DEFAULT nextval('public.product_store_stock_id_seq'::regclass);


--
-- Name: production_order id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_order ALTER COLUMN id SET DEFAULT nextval('public.production_order_id_seq'::regclass);


--
-- Name: promo_campaign id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_campaign ALTER COLUMN id SET DEFAULT nextval('public.promo_campaign_id_seq'::regclass);


--
-- Name: promo_reward id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_reward ALTER COLUMN id SET DEFAULT nextval('public.promo_reward_id_seq'::regclass);


--
-- Name: promo_rule id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_rule ALTER COLUMN id SET DEFAULT nextval('public.promo_rule_id_seq'::regclass);


--
-- Name: promo_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_usage ALTER COLUMN id SET DEFAULT nextval('public.promo_usage_id_seq'::regclass);


--
-- Name: purchase_order id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_id_seq'::regclass);


--
-- Name: purchase_order_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_item ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_item_id_seq'::regclass);


--
-- Name: purchase_payment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payment ALTER COLUMN id SET DEFAULT nextval('public.purchase_payment_id_seq'::regclass);


--
-- Name: purchase_return id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return ALTER COLUMN id SET DEFAULT nextval('public.purchase_return_id_seq'::regclass);


--
-- Name: purchase_return_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_item ALTER COLUMN id SET DEFAULT nextval('public.purchase_return_item_id_seq'::regclass);


--
-- Name: queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue ALTER COLUMN id SET DEFAULT nextval('public.queue_id_seq'::regclass);


--
-- Name: region id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region ALTER COLUMN id SET DEFAULT nextval('public.region_id_seq'::regclass);


--
-- Name: report_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_config ALTER COLUMN id SET DEFAULT nextval('public.report_config_id_seq'::regclass);


--
-- Name: reservation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation ALTER COLUMN id SET DEFAULT nextval('public.reservation_id_seq'::regclass);


--
-- Name: role id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role ALTER COLUMN id SET DEFAULT nextval('public.role_id_seq'::regclass);


--
-- Name: sales_return id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return ALTER COLUMN id SET DEFAULT nextval('public.sales_return_id_seq'::regclass);


--
-- Name: sales_return_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_item ALTER COLUMN id SET DEFAULT nextval('public.sales_return_item_id_seq'::regclass);


--
-- Name: sales_summary id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_summary ALTER COLUMN id SET DEFAULT nextval('public.sales_summary_id_seq'::regclass);


--
-- Name: shift id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift ALTER COLUMN id SET DEFAULT nextval('public.shift_id_seq'::regclass);


--
-- Name: shift_swap id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap ALTER COLUMN id SET DEFAULT nextval('public.shift_swap_id_seq'::regclass);


--
-- Name: shift_template id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_template ALTER COLUMN id SET DEFAULT nextval('public.shift_template_id_seq'::regclass);


--
-- Name: social_media id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_media ALTER COLUMN id SET DEFAULT nextval('public.social_media_id_seq'::regclass);


--
-- Name: split_bill id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.split_bill ALTER COLUMN id SET DEFAULT nextval('public.split_bill_id_seq'::regclass);


--
-- Name: station_dapur id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.station_dapur ALTER COLUMN id SET DEFAULT nextval('public.station_dapur_id_seq'::regclass);


--
-- Name: stock_forecast id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_forecast ALTER COLUMN id SET DEFAULT nextval('public.stock_forecast_id_seq'::regclass);


--
-- Name: stock_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_history ALTER COLUMN id SET DEFAULT nextval('public.stock_history_id_seq'::regclass);


--
-- Name: stock_opname id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_opname ALTER COLUMN id SET DEFAULT nextval('public.stock_opname_id_seq'::regclass);


--
-- Name: stock_opname_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_opname_item ALTER COLUMN id SET DEFAULT nextval('public.stock_opname_item_id_seq'::regclass);


--
-- Name: stock_transfer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer ALTER COLUMN id SET DEFAULT nextval('public.stock_transfer_id_seq'::regclass);


--
-- Name: stock_transfer_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_item ALTER COLUMN id SET DEFAULT nextval('public.stock_transfer_item_id_seq'::regclass);


--
-- Name: supplier id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier ALTER COLUMN id SET DEFAULT nextval('public.supplier_id_seq'::regclass);


--
-- Name: supplier_bank_account id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_bank_account ALTER COLUMN id SET DEFAULT nextval('public.supplier_bank_account_id_seq'::regclass);


--
-- Name: supplier_category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_category ALTER COLUMN id SET DEFAULT nextval('public.supplier_category_id_seq'::regclass);


--
-- Name: supplier_contact id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_contact ALTER COLUMN id SET DEFAULT nextval('public.supplier_contact_id_seq'::regclass);


--
-- Name: supplier_performance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_performance ALTER COLUMN id SET DEFAULT nextval('public.supplier_performance_id_seq'::regclass);


--
-- Name: supplier_product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_product ALTER COLUMN id SET DEFAULT nextval('public.supplier_product_id_seq'::regclass);


--
-- Name: supplier_score id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_score ALTER COLUMN id SET DEFAULT nextval('public.supplier_score_id_seq'::regclass);


--
-- Name: table id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."table" ALTER COLUMN id SET DEFAULT nextval('public.table_id_seq'::regclass);


--
-- Name: tax_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_config ALTER COLUMN id SET DEFAULT nextval('public.tax_config_id_seq'::regclass);


--
-- Name: transaction id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction ALTER COLUMN id SET DEFAULT nextval('public.transaction_id_seq'::regclass);


--
-- Name: type_payment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.type_payment ALTER COLUMN id SET DEFAULT nextval('public.type_payment_id_seq'::regclass);


--
-- Name: user id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user" ALTER COLUMN id SET DEFAULT nextval('public.user_id_seq'::regclass);


--
-- Name: waiter_request id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_request ALTER COLUMN id SET DEFAULT nextval('public.waiter_request_id_seq'::regclass);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: accounting_outbox accounting_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_outbox
    ADD CONSTRAINT accounting_outbox_pkey PRIMARY KEY (id);


--
-- Name: accounts_receivable accounts_receivable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_receivable
    ADD CONSTRAINT accounts_receivable_pkey PRIMARY KEY (id);


--
-- Name: ar_payment ar_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_payment
    ADD CONSTRAINT ar_payment_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: auditLog auditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."auditLog"
    ADD CONSTRAINT "auditLog_pkey" PRIMARY KEY (id);


--
-- Name: best_selling best_selling_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.best_selling
    ADD CONSTRAINT best_selling_pkey PRIMARY KEY (id);


--
-- Name: bom_header bom_header_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_header
    ADD CONSTRAINT bom_header_pkey PRIMARY KEY (id);


--
-- Name: bom_line bom_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line
    ADD CONSTRAINT bom_line_pkey PRIMARY KEY (id);


--
-- Name: business_trip_budget_item business_trip_budget_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_trip_budget_item
    ADD CONSTRAINT business_trip_budget_item_pkey PRIMARY KEY (id);


--
-- Name: business_trip_employee business_trip_employee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_trip_employee
    ADD CONSTRAINT business_trip_employee_pkey PRIMARY KEY (id);


--
-- Name: business_trip business_trip_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_trip
    ADD CONSTRAINT business_trip_pkey PRIMARY KEY (id);


--
-- Name: business_trip business_trip_tripNumber_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_trip
    ADD CONSTRAINT "business_trip_tripNumber_key" UNIQUE ("tripNumber");


--
-- Name: cash_register cash_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register
    ADD CONSTRAINT cash_register_pkey PRIMARY KEY (id);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);


--
-- Name: category_sales_summary category_sales_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_sales_summary
    ADD CONSTRAINT category_sales_summary_pkey PRIMARY KEY (id);


--
-- Name: category_store category_store_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_store
    ADD CONSTRAINT category_store_pkey PRIMARY KEY (id);


--
-- Name: checkout checkout_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout
    ADD CONSTRAINT checkout_pkey PRIMARY KEY (id);


--
-- Name: currency currency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currency
    ADD CONSTRAINT currency_pkey PRIMARY KEY (id);


--
-- Name: daily_report daily_report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_report
    ADD CONSTRAINT daily_report_pkey PRIMARY KEY (id);


--
-- Name: daily_summary daily_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summary
    ADD CONSTRAINT daily_summary_pkey PRIMARY KEY (id);


--
-- Name: db_backup db_backup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.db_backup
    ADD CONSTRAINT db_backup_pkey PRIMARY KEY (id);


--
-- Name: dead_stock_alert dead_stock_alert_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dead_stock_alert
    ADD CONSTRAINT dead_stock_alert_pkey PRIMARY KEY (id);


--
-- Name: delivery_order delivery_order_orderNumber_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_order
    ADD CONSTRAINT "delivery_order_orderNumber_key" UNIQUE ("orderNumber");


--
-- Name: delivery_order delivery_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_order
    ADD CONSTRAINT delivery_order_pkey PRIMARY KEY (id);


--
-- Name: delivery_status_history delivery_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_status_history
    ADD CONSTRAINT delivery_status_history_pkey PRIMARY KEY (id);


--
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (id);


--
-- Name: discount discount_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount
    ADD CONSTRAINT discount_code_key UNIQUE (code);


--
-- Name: discount discount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount
    ADD CONSTRAINT discount_pkey PRIMARY KEY (id);


--
-- Name: driver driver_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver
    ADD CONSTRAINT driver_pkey PRIMARY KEY (id);


--
-- Name: expense_category expense_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_category
    ADD CONSTRAINT expense_category_pkey PRIMARY KEY (id);


--
-- Name: expense_payment expense_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_payment
    ADD CONSTRAINT expense_payment_pkey PRIMARY KEY (id);


--
-- Name: expense expense_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_item goods_receipt_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_item
    ADD CONSTRAINT goods_receipt_item_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt goods_receipt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt
    ADD CONSTRAINT goods_receipt_pkey PRIMARY KEY (id);


--
-- Name: goods_request_item goods_request_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request_item
    ADD CONSTRAINT goods_request_item_pkey PRIMARY KEY (id);


--
-- Name: goods_request goods_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request
    ADD CONSTRAINT goods_request_pkey PRIMARY KEY (id);


--
-- Name: goods_request goods_request_requestNumber_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request
    ADD CONSTRAINT "goods_request_requestNumber_key" UNIQUE ("requestNumber");


--
-- Name: ingredient_category ingredient_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient_category
    ADD CONSTRAINT ingredient_category_pkey PRIMARY KEY (id);


--
-- Name: ingredient ingredient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient
    ADD CONSTRAINT ingredient_pkey PRIMARY KEY (id);


--
-- Name: inventory_valuation inventory_valuation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_valuation
    ADD CONSTRAINT inventory_valuation_pkey PRIMARY KEY (id);


--
-- Name: invoice_footer invoice_footer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_footer
    ADD CONSTRAINT invoice_footer_pkey PRIMARY KEY (id);


--
-- Name: invoice_logo invoice_logo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_logo
    ADD CONSTRAINT invoice_logo_pkey PRIMARY KEY (id);


--
-- Name: invoice_setting invoice_setting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_setting
    ADD CONSTRAINT invoice_setting_pkey PRIMARY KEY (id);


--
-- Name: invoice_setting invoice_setting_store_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_setting
    ADD CONSTRAINT invoice_setting_store_key UNIQUE (store);


--
-- Name: invoice_social_media invoice_social_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_social_media
    ADD CONSTRAINT invoice_social_media_pkey PRIMARY KEY (id);


--
-- Name: journal_entry_line journal_entry_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_line
    ADD CONSTRAINT journal_entry_line_pkey PRIMARY KEY (id);


--
-- Name: journal_entry journal_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry
    ADD CONSTRAINT journal_entry_pkey PRIMARY KEY (id);


--
-- Name: kasir_performance kasir_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kasir_performance
    ADD CONSTRAINT kasir_performance_pkey PRIMARY KEY (id);


--
-- Name: location location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location
    ADD CONSTRAINT location_pkey PRIMARY KEY (id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: member_point_history member_point_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_point_history
    ADD CONSTRAINT member_point_history_pkey PRIMARY KEY (id);


--
-- Name: member_tier member_tier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_tier
    ADD CONSTRAINT member_tier_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: order_daily_counter order_daily_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_daily_counter
    ADD CONSTRAINT order_daily_counter_pkey PRIMARY KEY (store, "counterDate");


--
-- Name: order_item order_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_pkey PRIMARY KEY (id);


--
-- Name: order order_orderNumber_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT "order_orderNumber_key" UNIQUE ("orderNumber");


--
-- Name: order order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_pkey PRIMARY KEY (id);


--
-- Name: order_status order_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status
    ADD CONSTRAINT order_status_pkey PRIMARY KEY (id);


--
-- Name: overtime overtime_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime
    ADD CONSTRAINT overtime_pkey PRIMARY KEY (id);


--
-- Name: position position_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_pkey PRIMARY KEY (id);


--
-- Name: price_list_template price_list_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_list_template
    ADD CONSTRAINT price_list_template_pkey PRIMARY KEY (id);


--
-- Name: product_batch product_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batch
    ADD CONSTRAINT product_batch_pkey PRIMARY KEY (id);


--
-- Name: product_batch_stock product_batch_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batch_stock
    ADD CONSTRAINT product_batch_stock_pkey PRIMARY KEY (id);


--
-- Name: product_bundle_item product_bundle_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle_item
    ADD CONSTRAINT product_bundle_item_pkey PRIMARY KEY (id);


--
-- Name: product_bundle product_bundle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle
    ADD CONSTRAINT product_bundle_pkey PRIMARY KEY (id);


--
-- Name: product_bundle product_bundle_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle
    ADD CONSTRAINT product_bundle_sku_key UNIQUE (sku);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- Name: product_review product_review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review
    ADD CONSTRAINT product_review_pkey PRIMARY KEY (id);


--
-- Name: product_sales_summary product_sales_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sales_summary
    ADD CONSTRAINT product_sales_summary_pkey PRIMARY KEY (id);


--
-- Name: product product_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_sku_key UNIQUE (sku);


--
-- Name: product_store product_store_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store
    ADD CONSTRAINT product_store_pkey PRIMARY KEY (id);


--
-- Name: product_store_price product_store_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store_price
    ADD CONSTRAINT product_store_price_pkey PRIMARY KEY (id);


--
-- Name: product_store_stock product_store_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store_stock
    ADD CONSTRAINT product_store_stock_pkey PRIMARY KEY (id);


--
-- Name: production_order production_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_order
    ADD CONSTRAINT production_order_pkey PRIMARY KEY (id);


--
-- Name: promo_campaign promo_campaign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_campaign
    ADD CONSTRAINT promo_campaign_pkey PRIMARY KEY (id);


--
-- Name: promo_reward promo_reward_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_reward
    ADD CONSTRAINT promo_reward_pkey PRIMARY KEY (id);


--
-- Name: promo_rule promo_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_rule
    ADD CONSTRAINT promo_rule_pkey PRIMARY KEY (id);


--
-- Name: promo_usage promo_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_usage
    ADD CONSTRAINT promo_usage_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_item purchase_order_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_item
    ADD CONSTRAINT purchase_order_item_pkey PRIMARY KEY (id);


--
-- Name: purchase_order purchase_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order
    ADD CONSTRAINT purchase_order_pkey PRIMARY KEY (id);


--
-- Name: purchase_payment purchase_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payment
    ADD CONSTRAINT purchase_payment_pkey PRIMARY KEY (id);


--
-- Name: purchase_return_item purchase_return_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_item
    ADD CONSTRAINT purchase_return_item_pkey PRIMARY KEY (id);


--
-- Name: purchase_return purchase_return_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return
    ADD CONSTRAINT purchase_return_pkey PRIMARY KEY (id);


--
-- Name: purchase_return purchase_return_returnNumber_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return
    ADD CONSTRAINT "purchase_return_returnNumber_key" UNIQUE ("returnNumber");


--
-- Name: queue queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue
    ADD CONSTRAINT queue_pkey PRIMARY KEY (id);


--
-- Name: region region_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region
    ADD CONSTRAINT region_pkey PRIMARY KEY (id);


--
-- Name: report_config report_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_config
    ADD CONSTRAINT report_config_key_key UNIQUE (key);


--
-- Name: report_config report_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_config
    ADD CONSTRAINT report_config_pkey PRIMARY KEY (id);


--
-- Name: reservation reservation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_pkey PRIMARY KEY (id);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: sales_return_item sales_return_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_item
    ADD CONSTRAINT sales_return_item_pkey PRIMARY KEY (id);


--
-- Name: sales_return sales_return_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return
    ADD CONSTRAINT sales_return_pkey PRIMARY KEY (id);


--
-- Name: sales_return sales_return_returnNumber_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return
    ADD CONSTRAINT "sales_return_returnNumber_key" UNIQUE ("returnNumber");


--
-- Name: sales_summary sales_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_summary
    ADD CONSTRAINT sales_summary_pkey PRIMARY KEY (id);


--
-- Name: scheduler_lock scheduler_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduler_lock
    ADD CONSTRAINT scheduler_lock_pkey PRIMARY KEY (name);


--
-- Name: shift shift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift
    ADD CONSTRAINT shift_pkey PRIMARY KEY (id);


--
-- Name: shift_swap shift_swap_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap
    ADD CONSTRAINT shift_swap_pkey PRIMARY KEY (id);


--
-- Name: shift_template shift_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_template
    ADD CONSTRAINT shift_template_pkey PRIMARY KEY (id);


--
-- Name: social_media social_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_media
    ADD CONSTRAINT social_media_pkey PRIMARY KEY (id);


--
-- Name: split_bill split_bill_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.split_bill
    ADD CONSTRAINT split_bill_pkey PRIMARY KEY (id);


--
-- Name: station_dapur station_dapur_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.station_dapur
    ADD CONSTRAINT station_dapur_pkey PRIMARY KEY (id);


--
-- Name: stock_forecast stock_forecast_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_forecast
    ADD CONSTRAINT stock_forecast_pkey PRIMARY KEY (id);


--
-- Name: stock_history stock_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_history
    ADD CONSTRAINT stock_history_pkey PRIMARY KEY (id);


--
-- Name: stock_opname_item stock_opname_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_opname_item
    ADD CONSTRAINT stock_opname_item_pkey PRIMARY KEY (id);


--
-- Name: stock_opname stock_opname_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_opname
    ADD CONSTRAINT stock_opname_pkey PRIMARY KEY (id);


--
-- Name: stock_transfer_item stock_transfer_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_item
    ADD CONSTRAINT stock_transfer_item_pkey PRIMARY KEY (id);


--
-- Name: stock_transfer stock_transfer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer
    ADD CONSTRAINT stock_transfer_pkey PRIMARY KEY (id);


--
-- Name: stock_transfer stock_transfer_transferNumber_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer
    ADD CONSTRAINT "stock_transfer_transferNumber_key" UNIQUE ("transferNumber");


--
-- Name: supplier_bank_account supplier_bank_account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_bank_account
    ADD CONSTRAINT supplier_bank_account_pkey PRIMARY KEY (id);


--
-- Name: supplier_category supplier_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_category
    ADD CONSTRAINT supplier_category_pkey PRIMARY KEY (id);


--
-- Name: supplier_contact supplier_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_contact
    ADD CONSTRAINT supplier_contact_pkey PRIMARY KEY (id);


--
-- Name: supplier_performance supplier_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_performance
    ADD CONSTRAINT supplier_performance_pkey PRIMARY KEY (id);


--
-- Name: supplier supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_pkey PRIMARY KEY (id);


--
-- Name: supplier_product supplier_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_product
    ADD CONSTRAINT supplier_product_pkey PRIMARY KEY (id);


--
-- Name: supplier_score supplier_score_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_score
    ADD CONSTRAINT supplier_score_pkey PRIMARY KEY (id);


--
-- Name: table table_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."table"
    ADD CONSTRAINT table_pkey PRIMARY KEY (id);


--
-- Name: tax_config tax_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_config
    ADD CONSTRAINT tax_config_pkey PRIMARY KEY (id);


--
-- Name: transaction transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT transaction_pkey PRIMARY KEY (id);


--
-- Name: type_payment type_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.type_payment
    ADD CONSTRAINT type_payment_pkey PRIMARY KEY (id);


--
-- Name: category_store uq_category_store_category_store; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_store
    ADD CONSTRAINT uq_category_store_category_store UNIQUE (category, store);


--
-- Name: product_store uq_product_store_product_store; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store
    ADD CONSTRAINT uq_product_store_product_store UNIQUE (product, store);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_employeeID_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "user_employeeID_key" UNIQUE ("employeeID");


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user user_userName_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "user_userName_key" UNIQUE ("userName");


--
-- Name: waiter_request waiter_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_request
    ADD CONSTRAINT waiter_request_pkey PRIMARY KEY (id);


--
-- Name: account_store_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_store_code ON public.account USING btree (store, code);


--
-- Name: account_store_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_store_code_unique ON public.account USING btree (store, code);


--
-- Name: account_store_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_store_type_idx ON public.account USING btree (store, type);


--
-- Name: accounting_outbox_reference_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounting_outbox_reference_idx ON public.accounting_outbox USING btree ("referenceType", "referenceId");


--
-- Name: accounting_outbox_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounting_outbox_status_created_idx ON public.accounting_outbox USING btree (status, "createdAt");


--
-- Name: best_selling_productId_store_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "best_selling_productId_store_unique" ON public.best_selling USING btree ("productId", store) WHERE ("deletedAt" IS NULL);


--
-- Name: business_trip_budget_item_trip_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_trip_budget_item_trip_id ON public.business_trip_budget_item USING btree ("tripId");


--
-- Name: business_trip_employee_trip_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_trip_employee_trip_id ON public.business_trip_employee USING btree ("tripId");


--
-- Name: business_trip_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_trip_status ON public.business_trip USING btree (status);


--
-- Name: business_trip_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_trip_store ON public.business_trip USING btree (store);


--
-- Name: category_sales_summary_report_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX category_sales_summary_report_date ON public.category_sales_summary USING btree (report_date);


--
-- Name: category_sales_summary_store_category_report_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX category_sales_summary_store_category_report_date ON public.category_sales_summary USING btree (store, category, report_date);


--
-- Name: category_store_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX category_store_category ON public.category_store USING btree (category) WHERE ("deletedAt" IS NULL);


--
-- Name: category_store_category_store; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX category_store_category_store ON public.category_store USING btree (category, store);


--
-- Name: category_store_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX category_store_store ON public.category_store USING btree (store) WHERE ("deletedAt" IS NULL);


--
-- Name: daily_summary_store_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX daily_summary_store_date ON public.daily_summary USING btree (store, date);


--
-- Name: dead_stock_alert_alert_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dead_stock_alert_alert_level ON public.dead_stock_alert USING btree (alert_level);


--
-- Name: dead_stock_alert_alert_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dead_stock_alert_alert_status ON public.dead_stock_alert USING btree (alert_status);


--
-- Name: dead_stock_alert_days_without_sale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dead_stock_alert_days_without_sale ON public.dead_stock_alert USING btree (days_without_sale);


--
-- Name: dead_stock_alert_product_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dead_stock_alert_product_store ON public.dead_stock_alert USING btree (product, store);


--
-- Name: delivery_order_driver_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_order_driver_id ON public.delivery_order USING btree ("driverId");


--
-- Name: delivery_order_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_order_order ON public.delivery_order USING btree ("order");


--
-- Name: delivery_order_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_order_source ON public.delivery_order USING btree (source);


--
-- Name: delivery_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_order_status ON public.delivery_order USING btree (status);


--
-- Name: delivery_order_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_order_store ON public.delivery_order USING btree (store);


--
-- Name: delivery_status_history_delivery_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_status_history_delivery_order ON public.delivery_status_history USING btree ("deliveryOrder");


--
-- Name: goods_request_item_goods_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goods_request_item_goods_request ON public.goods_request_item USING btree ("goodsRequest");


--
-- Name: goods_request_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goods_request_status ON public.goods_request USING btree (status);


--
-- Name: goods_request_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goods_request_store ON public.goods_request USING btree (store);


--
-- Name: idx_supplier_product_price_compare; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_product_price_compare ON public.supplier_product USING btree ("productId", price) WHERE (("deletedAt" IS NULL) AND ("productId" IS NOT NULL));


--
-- Name: inventory_valuation_cogs_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_valuation_cogs_method ON public.inventory_valuation USING btree (cogs_method);


--
-- Name: inventory_valuation_product_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_valuation_product_store ON public.inventory_valuation USING btree (product, store);


--
-- Name: inventory_valuation_valuation_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_valuation_valuation_date ON public.inventory_valuation USING btree (valuation_date);


--
-- Name: journal_entry_line_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entry_line_account_idx ON public.journal_entry_line USING btree (account);


--
-- Name: journal_entry_line_journal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entry_line_journal_idx ON public.journal_entry_line USING btree ("journalEntry");


--
-- Name: journal_entry_store_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entry_store_date_idx ON public.journal_entry USING btree (store, date);


--
-- Name: kasir_performance_report_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kasir_performance_report_date ON public.kasir_performance USING btree (report_date);


--
-- Name: kasir_performance_store_cashier_report_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kasir_performance_store_cashier_report_date ON public.kasir_performance USING btree (store, cashier, report_date);


--
-- Name: notification_store_isRead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notification_store_isRead" ON public.notification USING btree (store, "isRead");


--
-- Name: notification_updatedAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "notification_updatedAt" ON public.notification USING btree ("updatedAt");


--
-- Name: order_item_bundle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_item_bundle_id ON public.order_item USING btree ("bundleId") WHERE ("deletedAt" IS NULL);


--
-- Name: order_item_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_item_order_idx ON public.order_item USING btree ("order");


--
-- Name: order_item_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_item_product_idx ON public.order_item USING btree (product);


--
-- Name: order_promo_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_promo_campaign_id ON public."order" USING btree ("promoCampaignId") WHERE ("deletedAt" IS NULL);


--
-- Name: order_public_token_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX order_public_token_unique ON public."order" USING btree ("publicToken") WHERE ("publicToken" IS NOT NULL);


--
-- Name: order_store_createdAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "order_store_createdAt" ON public."order" USING btree (store, "createdAt");


--
-- Name: order_store_idempotencykey_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX order_store_idempotencykey_unique ON public."order" USING btree (store, "idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL);


--
-- Name: order_store_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_store_status ON public."order" USING btree (store, status);


--
-- Name: product_batch_expiry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_batch_expiry_date ON public.product_batch USING btree ("expiryDate");


--
-- Name: product_batch_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_batch_product ON public.product_batch USING btree (product);


--
-- Name: product_batch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_batch_status ON public.product_batch USING btree (status);


--
-- Name: product_batch_stock_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_batch_stock_batch ON public.product_batch_stock USING btree (batch);


--
-- Name: product_batch_stock_batch_store; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_batch_stock_batch_store ON public.product_batch_stock USING btree (batch, store);


--
-- Name: product_batch_stock_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_batch_stock_store ON public.product_batch_stock USING btree (store);


--
-- Name: product_batch_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_batch_supplier ON public.product_batch USING btree (supplier);


--
-- Name: product_bundle_item_bundle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_bundle_item_bundle_id ON public.product_bundle_item USING btree ("bundleId") WHERE ("deletedAt" IS NULL);


--
-- Name: product_bundle_item_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_bundle_item_product ON public.product_bundle_item USING btree (product) WHERE ("deletedAt" IS NULL);


--
-- Name: product_bundle_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_bundle_sku ON public.product_bundle USING btree (sku) WHERE ("deletedAt" IS NULL);


--
-- Name: product_bundle_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_bundle_status ON public.product_bundle USING btree (status) WHERE ("deletedAt" IS NULL);


--
-- Name: product_bundle_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_bundle_store ON public.product_bundle USING gin (store) WHERE ("deletedAt" IS NULL);


--
-- Name: product_sales_summary_report_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_sales_summary_report_date ON public.product_sales_summary USING btree (report_date);


--
-- Name: product_sales_summary_store_product_report_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_sales_summary_store_product_report_date ON public.product_sales_summary USING btree (store, product, report_date);


--
-- Name: product_store_price_product_store; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_store_price_product_store ON public.product_store_price USING btree (product, store);


--
-- Name: product_store_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_store_product ON public.product_store USING btree (product) WHERE ("deletedAt" IS NULL);


--
-- Name: product_store_product_store; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_store_product_store ON public.product_store USING btree (product, store);


--
-- Name: product_store_stock_product_store_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_store_stock_product_store_key ON public.product_store_stock USING btree (product, store);


--
-- Name: product_store_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_store_store ON public.product_store USING btree (store) WHERE ("deletedAt" IS NULL);


--
-- Name: promo_campaign_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX promo_campaign_code ON public.promo_campaign USING btree (code) WHERE ("deletedAt" IS NULL);


--
-- Name: promo_campaign_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_campaign_status ON public.promo_campaign USING btree (status) WHERE ("deletedAt" IS NULL);


--
-- Name: promo_campaign_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_campaign_store ON public.promo_campaign USING gin (store) WHERE ("deletedAt" IS NULL);


--
-- Name: promo_campaign_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_campaign_type ON public.promo_campaign USING btree (type) WHERE ("deletedAt" IS NULL);


--
-- Name: promo_reward_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_reward_campaign_id ON public.promo_reward USING btree ("campaignId") WHERE ("deletedAt" IS NULL);


--
-- Name: promo_reward_reward_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_reward_reward_type ON public.promo_reward USING btree ("rewardType") WHERE ("deletedAt" IS NULL);


--
-- Name: promo_rule_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_rule_campaign_id ON public.promo_rule USING btree ("campaignId") WHERE ("deletedAt" IS NULL);


--
-- Name: promo_rule_rule_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_rule_rule_type ON public.promo_rule USING btree ("ruleType") WHERE ("deletedAt" IS NULL);


--
-- Name: promo_usage_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_usage_campaign_id ON public.promo_usage USING btree ("campaignId") WHERE ("deletedAt" IS NULL);


--
-- Name: promo_usage_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_usage_member_id ON public.promo_usage USING btree ("memberId") WHERE ("deletedAt" IS NULL);


--
-- Name: promo_usage_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_usage_order_id ON public.promo_usage USING btree ("orderId") WHERE ("deletedAt" IS NULL);


--
-- Name: promo_usage_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_usage_store ON public.promo_usage USING gin (store) WHERE ("deletedAt" IS NULL);


--
-- Name: purchase_payment_po_idempotencykey_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX purchase_payment_po_idempotencykey_unique ON public.purchase_payment USING btree ("purchaseOrder", "idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL);


--
-- Name: queue_queue_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX queue_queue_number ON public.queue USING btree ("queueNumber") WHERE ("deletedAt" IS NULL);


--
-- Name: queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX queue_status ON public.queue USING btree (status) WHERE ("deletedAt" IS NULL);


--
-- Name: queue_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX queue_store ON public.queue USING gin (store) WHERE ("deletedAt" IS NULL);


--
-- Name: sales_summary_report_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_summary_report_date ON public.sales_summary USING btree (report_date);


--
-- Name: sales_summary_store_report_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_summary_store_report_date ON public.sales_summary USING btree (store, report_date);


--
-- Name: shift_swap_requester_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_swap_requester_id ON public.shift_swap USING btree ("requesterId");


--
-- Name: shift_swap_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_swap_status ON public.shift_swap USING btree (status);


--
-- Name: shift_swap_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_swap_store ON public.shift_swap USING btree (store);


--
-- Name: shift_swap_target_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_swap_target_id ON public.shift_swap USING btree ("targetId");


--
-- Name: split_bill_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX split_bill_order ON public.split_bill USING btree ("order");


--
-- Name: stock_forecast_days_until_stockout; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_forecast_days_until_stockout ON public.stock_forecast USING btree (days_until_stockout);


--
-- Name: stock_forecast_forecast_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_forecast_forecast_date ON public.stock_forecast USING btree (forecast_date);


--
-- Name: stock_forecast_forecasted_stockout_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_forecast_forecasted_stockout_date ON public.stock_forecast USING btree (forecasted_stockout_date);


--
-- Name: stock_forecast_product_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_forecast_product_store ON public.stock_forecast USING btree (product, store);


--
-- Name: stock_history_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_history_ingredient ON public.stock_history USING btree (ingredient);


--
-- Name: stock_history_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_history_product ON public.stock_history USING btree (product);


--
-- Name: stock_history_store_createdAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stock_history_store_createdAt" ON public.stock_history USING btree (store, "createdAt");


--
-- Name: supplier_bank_account_supplier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_bank_account_supplier_idx ON public.supplier_bank_account USING btree (supplier);


--
-- Name: supplier_category_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_category_name_idx ON public.supplier_category USING btree (name);


--
-- Name: supplier_category_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_category_status_idx ON public.supplier_category USING btree (status);


--
-- Name: supplier_contact_supplier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_contact_supplier_idx ON public.supplier_contact USING btree (supplier);


--
-- Name: supplier_performance_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_performance_month ON public.supplier_performance USING btree (month);


--
-- Name: supplier_performance_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_performance_supplier ON public.supplier_performance USING btree (supplier);


--
-- Name: supplier_performance_supplier_month; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX supplier_performance_supplier_month ON public.supplier_performance USING btree (supplier, month);


--
-- Name: supplier_product_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_product_product ON public.supplier_product USING btree (name) WHERE ("deletedAt" IS NULL);


--
-- Name: supplier_product_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_product_product_id ON public.supplier_product USING btree ("productId") WHERE ("deletedAt" IS NULL);


--
-- Name: supplier_product_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_product_supplier ON public.supplier_product USING btree (supplier) WHERE ("deletedAt" IS NULL);


--
-- Name: supplier_score_overall_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_score_overall_score ON public.supplier_score USING btree ("overallScore") WHERE ("deletedAt" IS NULL);


--
-- Name: supplier_score_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_score_period ON public.supplier_score USING btree (period) WHERE ("deletedAt" IS NULL);


--
-- Name: supplier_score_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_score_store ON public.supplier_score USING gin (store) WHERE ("deletedAt" IS NULL);


--
-- Name: supplier_score_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplier_score_supplier_id ON public.supplier_score USING btree ("supplierId") WHERE ("deletedAt" IS NULL);


--
-- Name: transaction_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transaction_order_idx ON public.transaction USING btree ("order");


--
-- Name: uq_supplier_product_supplier_productId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "uq_supplier_product_supplier_productId" ON public.supplier_product USING btree (supplier, "productId") WHERE (("productId" IS NOT NULL) AND ("deletedAt" IS NULL));


--
-- Name: waiter_request_request_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX waiter_request_request_number ON public.waiter_request USING btree ("requestNumber") WHERE ("deletedAt" IS NULL);


--
-- Name: waiter_request_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waiter_request_status ON public.waiter_request USING btree (status) WHERE ("deletedAt" IS NULL);


--
-- Name: waiter_request_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waiter_request_store ON public.waiter_request USING gin (store) WHERE ("deletedAt" IS NULL);


--
-- Name: accounts_receivable accounts_receivable_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_receivable
    ADD CONSTRAINT "accounts_receivable_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."order"(id) ON UPDATE CASCADE;


--
-- Name: ar_payment ar_payment_arId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_payment
    ADD CONSTRAINT "ar_payment_arId_fkey" FOREIGN KEY ("arId") REFERENCES public.accounts_receivable(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: attendance attendance_shiftId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "attendance_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES public.shift(id) ON UPDATE CASCADE;


--
-- Name: attendance attendance_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: attendance attendance_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: auditLog auditLog_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."auditLog"
    ADD CONSTRAINT "auditLog_store_fkey" FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bom_header bom_header_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_header
    ADD CONSTRAINT "bom_header_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE;


--
-- Name: bom_header bom_header_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_header
    ADD CONSTRAINT bom_header_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: bom_line bom_line_bomHeaderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line
    ADD CONSTRAINT "bom_line_bomHeaderId_fkey" FOREIGN KEY ("bomHeaderId") REFERENCES public.bom_header(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bom_line bom_line_ingredientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line
    ADD CONSTRAINT "bom_line_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES public.ingredient(id) ON UPDATE CASCADE;


--
-- Name: cash_register cash_register_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register
    ADD CONSTRAINT cash_register_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: cash_register cash_register_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register
    ADD CONSTRAINT cash_register_user_fkey FOREIGN KEY ("user") REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: currency currency_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currency
    ADD CONSTRAINT currency_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: delivery_order delivery_order_driverId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_order
    ADD CONSTRAINT "delivery_order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES public.driver(id) ON DELETE SET NULL;


--
-- Name: delivery_order delivery_order_order_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_order
    ADD CONSTRAINT delivery_order_order_fkey FOREIGN KEY ("order") REFERENCES public."order"(id) ON DELETE SET NULL;


--
-- Name: delivery_order delivery_order_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_order
    ADD CONSTRAINT delivery_order_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON DELETE SET NULL;


--
-- Name: delivery_status_history delivery_status_history_deliveryOrder_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_status_history
    ADD CONSTRAINT "delivery_status_history_deliveryOrder_fkey" FOREIGN KEY ("deliveryOrder") REFERENCES public.delivery_order(id) ON DELETE CASCADE;


--
-- Name: expense expense_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_category_fkey FOREIGN KEY (category) REFERENCES public.expense_category(id) ON UPDATE CASCADE;


--
-- Name: expense expense_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT "expense_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: expense expense_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT "expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: expense expense_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT "expense_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.expense(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: expense_payment expense_payment_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_payment
    ADD CONSTRAINT "expense_payment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: expense_payment expense_payment_expenseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_payment
    ADD CONSTRAINT "expense_payment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES public.expense(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: supplier_product fk_supplier_product_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_product
    ADD CONSTRAINT fk_supplier_product_product FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: goods_receipt_item goods_receipt_item_goodsReceipt_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_item
    ADD CONSTRAINT "goods_receipt_item_goodsReceipt_fkey" FOREIGN KEY ("goodsReceipt") REFERENCES public.goods_receipt(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: goods_receipt_item goods_receipt_item_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_item
    ADD CONSTRAINT goods_receipt_item_product_fkey FOREIGN KEY (product) REFERENCES public.product(id) ON UPDATE CASCADE;


--
-- Name: goods_receipt_item goods_receipt_item_purchaseOrderItem_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_item
    ADD CONSTRAINT "goods_receipt_item_purchaseOrderItem_fkey" FOREIGN KEY ("purchaseOrderItem") REFERENCES public.purchase_order_item(id) ON UPDATE CASCADE;


--
-- Name: goods_receipt goods_receipt_purchaseOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt
    ADD CONSTRAINT "goods_receipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES public.purchase_order(id) ON UPDATE CASCADE;


--
-- Name: goods_receipt goods_receipt_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt
    ADD CONSTRAINT goods_receipt_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: goods_request goods_request_approvedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request
    ADD CONSTRAINT "goods_request_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES public."user"(id);


--
-- Name: goods_request goods_request_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request
    ADD CONSTRAINT "goods_request_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."user"(id);


--
-- Name: goods_request_item goods_request_item_goodsRequest_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request_item
    ADD CONSTRAINT "goods_request_item_goodsRequest_fkey" FOREIGN KEY ("goodsRequest") REFERENCES public.goods_request(id);


--
-- Name: goods_request_item goods_request_item_ingredient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request_item
    ADD CONSTRAINT goods_request_item_ingredient_fkey FOREIGN KEY (ingredient) REFERENCES public.ingredient(id);


--
-- Name: goods_request_item goods_request_item_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request_item
    ADD CONSTRAINT goods_request_item_product_fkey FOREIGN KEY (product) REFERENCES public.product(id);


--
-- Name: goods_request_item goods_request_item_supplier_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request_item
    ADD CONSTRAINT goods_request_item_supplier_fkey FOREIGN KEY (supplier) REFERENCES public.supplier(id);


--
-- Name: goods_request goods_request_modifiedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request
    ADD CONSTRAINT "goods_request_modifiedBy_fkey" FOREIGN KEY ("modifiedBy") REFERENCES public."user"(id);


--
-- Name: goods_request goods_request_purchaseOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request
    ADD CONSTRAINT "goods_request_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES public.purchase_order(id);


--
-- Name: goods_request goods_request_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_request
    ADD CONSTRAINT goods_request_store_fkey FOREIGN KEY (store) REFERENCES public.location(id);


--
-- Name: ingredient ingredient_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient
    ADD CONSTRAINT ingredient_category_fkey FOREIGN KEY (category) REFERENCES public.ingredient_category(id) ON UPDATE CASCADE;


--
-- Name: ingredient ingredient_supplier_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient
    ADD CONSTRAINT ingredient_supplier_fkey FOREIGN KEY (supplier) REFERENCES public.supplier(id) ON UPDATE CASCADE;


--
-- Name: journal_entry_line journal_entry_line_account_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_line
    ADD CONSTRAINT journal_entry_line_account_fkey FOREIGN KEY (account) REFERENCES public.account(id) ON DELETE RESTRICT;


--
-- Name: journal_entry_line journal_entry_line_journalEntry_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_line
    ADD CONSTRAINT "journal_entry_line_journalEntry_fkey" FOREIGN KEY ("journalEntry") REFERENCES public.journal_entry(id) ON DELETE CASCADE;


--
-- Name: member_point_history member_point_history_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_point_history
    ADD CONSTRAINT "member_point_history_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: member_point_history member_point_history_member_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_point_history
    ADD CONSTRAINT member_point_history_member_fkey FOREIGN KEY (member) REFERENCES public.member(id) ON UPDATE CASCADE;


--
-- Name: notification notification_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: order order_currencyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT "order_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES public.currency(id);


--
-- Name: order order_discountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT "order_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES public.discount(id);


--
-- Name: order_item order_item_bundleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT "order_item_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES public.product_bundle(id);


--
-- Name: order_item order_item_order_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item
    ADD CONSTRAINT order_item_order_fkey FOREIGN KEY ("order") REFERENCES public."order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order order_promoCampaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT "order_promoCampaignId_fkey" FOREIGN KEY ("promoCampaignId") REFERENCES public.promo_campaign(id);


--
-- Name: order_status order_status_order_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status
    ADD CONSTRAINT order_status_order_fkey FOREIGN KEY ("order") REFERENCES public."order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order order_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: order order_tableId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT "order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES public."table"(id) ON UPDATE CASCADE;


--
-- Name: overtime overtime_decidedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime
    ADD CONSTRAINT "overtime_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: overtime overtime_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime
    ADD CONSTRAINT overtime_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: overtime overtime_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime
    ADD CONSTRAINT overtime_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shift(id) ON UPDATE CASCADE;


--
-- Name: overtime overtime_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime
    ADD CONSTRAINT overtime_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: position position_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT "position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.department(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_batch product_batch_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batch
    ADD CONSTRAINT product_batch_product_fkey FOREIGN KEY (product) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_batch product_batch_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_batch
    ADD CONSTRAINT product_batch_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: product_bundle_item product_bundle_item_bundleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle_item
    ADD CONSTRAINT "product_bundle_item_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES public.product_bundle(id);


--
-- Name: product_bundle_item product_bundle_item_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_bundle_item
    ADD CONSTRAINT product_bundle_item_product_fkey FOREIGN KEY (product) REFERENCES public.product(id);


--
-- Name: product product_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_category_fkey FOREIGN KEY (category) REFERENCES public.category(id) ON UPDATE CASCADE;


--
-- Name: product product_currencyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT "product_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES public.currency(id);


--
-- Name: product_review product_review_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review
    ADD CONSTRAINT "product_review_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE;


--
-- Name: product_store_price product_store_price_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store_price
    ADD CONSTRAINT product_store_price_product_fkey FOREIGN KEY (product) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_store_price product_store_price_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store_price
    ADD CONSTRAINT product_store_price_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: product_store_stock product_store_stock_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store_stock
    ADD CONSTRAINT product_store_stock_product_fkey FOREIGN KEY (product) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_store_stock product_store_stock_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_store_stock
    ADD CONSTRAINT product_store_stock_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: production_order production_order_productItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_order
    ADD CONSTRAINT "production_order_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES public.product(id) ON UPDATE CASCADE;


--
-- Name: production_order production_order_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_order
    ADD CONSTRAINT production_order_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: purchase_order_item purchase_order_item_ingredient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_item
    ADD CONSTRAINT purchase_order_item_ingredient_fkey FOREIGN KEY (ingredient) REFERENCES public.ingredient(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_order_item purchase_order_item_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_item
    ADD CONSTRAINT purchase_order_item_product_fkey FOREIGN KEY (product) REFERENCES public.product(id) ON UPDATE CASCADE;


--
-- Name: purchase_order_item purchase_order_item_purchaseOrder_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_item
    ADD CONSTRAINT "purchase_order_item_purchaseOrder_fkey" FOREIGN KEY ("purchaseOrder") REFERENCES public.purchase_order(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_order purchase_order_pic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order
    ADD CONSTRAINT purchase_order_pic_fkey FOREIGN KEY (pic) REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: purchase_order purchase_order_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order
    ADD CONSTRAINT purchase_order_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: purchase_payment purchase_payment_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payment
    ADD CONSTRAINT "purchase_payment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: purchase_payment purchase_payment_purchaseOrder_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payment
    ADD CONSTRAINT "purchase_payment_purchaseOrder_fkey" FOREIGN KEY ("purchaseOrder") REFERENCES public.purchase_order(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_payment purchase_payment_supplier_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_payment
    ADD CONSTRAINT purchase_payment_supplier_fkey FOREIGN KEY (supplier) REFERENCES public.supplier(id) ON UPDATE CASCADE;


--
-- Name: purchase_return purchase_return_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return
    ADD CONSTRAINT "purchase_return_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: purchase_return_item purchase_return_item_ingredient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_item
    ADD CONSTRAINT purchase_return_item_ingredient_fkey FOREIGN KEY (ingredient) REFERENCES public.ingredient(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_return_item purchase_return_item_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_item
    ADD CONSTRAINT purchase_return_item_product_fkey FOREIGN KEY (product) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_return_item purchase_return_item_purchaseReturn_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_item
    ADD CONSTRAINT "purchase_return_item_purchaseReturn_fkey" FOREIGN KEY ("purchaseReturn") REFERENCES public.purchase_return(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_return purchase_return_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return
    ADD CONSTRAINT purchase_return_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: role role_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_return sales_return_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return
    ADD CONSTRAINT "sales_return_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: sales_return_item sales_return_item_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_item
    ADD CONSTRAINT sales_return_item_product_fkey FOREIGN KEY (product) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_return_item sales_return_item_salesReturn_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_item
    ADD CONSTRAINT "sales_return_item_salesReturn_fkey" FOREIGN KEY ("salesReturn") REFERENCES public.sales_return(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_return sales_return_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return
    ADD CONSTRAINT sales_return_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: split_bill split_bill_order_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.split_bill
    ADD CONSTRAINT split_bill_order_fkey FOREIGN KEY ("order") REFERENCES public."order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_history stock_history_ingredient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_history
    ADD CONSTRAINT stock_history_ingredient_fkey FOREIGN KEY (ingredient) REFERENCES public.ingredient(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: stock_history stock_history_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_history
    ADD CONSTRAINT stock_history_product_fkey FOREIGN KEY (product) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_opname_item stock_opname_item_stockOpname_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_opname_item
    ADD CONSTRAINT "stock_opname_item_stockOpname_fkey" FOREIGN KEY ("stockOpname") REFERENCES public.stock_opname(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_opname stock_opname_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_opname
    ADD CONSTRAINT stock_opname_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: stock_transfer stock_transfer_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer
    ADD CONSTRAINT "stock_transfer_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."user"(id) ON UPDATE CASCADE;


--
-- Name: stock_transfer stock_transfer_fromStore_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer
    ADD CONSTRAINT "stock_transfer_fromStore_fkey" FOREIGN KEY ("fromStore") REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: stock_transfer_item stock_transfer_item_product_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_item
    ADD CONSTRAINT stock_transfer_item_product_fkey FOREIGN KEY (product) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_transfer_item stock_transfer_item_stockTransfer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_item
    ADD CONSTRAINT "stock_transfer_item_stockTransfer_fkey" FOREIGN KEY ("stockTransfer") REFERENCES public.stock_transfer(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_transfer stock_transfer_toStore_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer
    ADD CONSTRAINT "stock_transfer_toStore_fkey" FOREIGN KEY ("toStore") REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- Name: supplier_bank_account supplier_bank_account_supplier_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_bank_account
    ADD CONSTRAINT supplier_bank_account_supplier_fkey FOREIGN KEY (supplier) REFERENCES public.supplier(id) ON DELETE CASCADE;


--
-- Name: supplier_contact supplier_contact_supplier_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_contact
    ADD CONSTRAINT supplier_contact_supplier_fkey FOREIGN KEY (supplier) REFERENCES public.supplier(id) ON DELETE CASCADE;


--
-- Name: transaction transaction_order_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT transaction_order_fkey FOREIGN KEY ("order") REFERENCES public."order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user user_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "user_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.department(id) ON UPDATE CASCADE;


--
-- Name: user user_position_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_position_fkey FOREIGN KEY ("position") REFERENCES public."position"(id) ON UPDATE CASCADE;


--
-- Name: user user_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "user_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.role(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user user_store_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_store_fkey FOREIGN KEY (store) REFERENCES public.location(id) ON UPDATE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict UmXaojvgJ2CHsBegf1Cg8Iew9HfPxeBmc4kMdYd6KaD6PU8UE4fHyRMSUQfMmL5

