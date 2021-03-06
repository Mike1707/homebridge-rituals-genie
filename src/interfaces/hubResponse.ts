export interface Attributes {
    roomc?: string;
    speedc?: string;
    fanc?: string;
    resetc?: string;
}

export interface Wific {
    id: number;
    sensor_id: number;
    title: string;
    description: string;
    icon: string;
    image: string;
    discover_image: string;
    discover_url?: string;
    min_value: string;
    max_value: string;
    interval: string;
    created_at: string;
    updated_at: string;
    default: number;
}

export interface Fillc {
    id: number;
    sensor_id: number;
    title: string;
    description: string;
    icon: string;
    image: string;
    discover_image: string;
    discover_url: string;
    min_value: string;
    max_value: string;
    interval: string;
    created_at: string;
    updated_at: string;
    default: number;
}

export interface Rfidc {
    id: number;
    sensor_id: number;
    title: string;
    description: string;
    icon: string;
    image: string;
    discover_image: string;
    discover_url: string;
    min_value: string;
    max_value: string;
    interval: string;
    created_at: string;
    updated_at: string;
    default: number;
}

export interface Rpsc {
    id: number;
    sensor_id: number;
    title: string;
    description: string;
    icon: string;
    image: string;
    discover_image: string;
    discover_url?: string;
    min_value: string;
    max_value: string;
    interval: string;
    created_at: string;
    updated_at: string;
    default: number;
}

export interface Onlinec {
    id: number;
    sensor_id: number;
    title: string;
    description: string;
    icon: string;
    image: string;
    discover_image: string;
    discover_url?: string;
    min_value: string;
    max_value: string;
    interval: string;
    created_at: string;
    updated_at: string;
    default: number;
}

export interface Sensors {
    wific: Wific;
    fillc?: Fillc;
    rfidc: Rfidc;
    versionc: string;
    ipc?: string;
    rpsc?: Rpsc;
    resetc?: string;
    chipidc?: string;
    errorc?: string;
    onlinec?: Onlinec;
}

export interface Hub {
    hublot: string;
    hash: string;
    status: number;
    title?: string;
    current_time: string;
    ping_update: string;
    attributes: Attributes;
    sensors?: Sensors;
}

export interface HubResponse {
    hub: Hub;
}