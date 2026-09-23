"use client";

/**
 * Live Studio Next (chain 61997) status badge — fed exclusively by the
 * /api/studionext/status route, whose every field is read from the chain at
 * request time (raw eth_chainId + real contract view calls). Shows OFFLINE
 * with the actual error when the network is down or reset; never displays a
 * fabricated or hardcoded value.
 */
import { useEffect, useState } from "react";

type StatusPayload = {
  chainId: number | null;
  contractAddress: string | null;
  reachable: boolean;
  contractName: string | null;
  verificationCount: number | null;
  error: string | null;
  checkedAt: string;
};

const EXPLORER = "https://explorer-studio-dev.genlayer.com";

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function StudioNextStatus() {
  const [status, setStatus] = useState<StatusPayload | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/studionext/status")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: StatusPayload) => {
        if (alive) setStatus(data);
      })
      .catch(() => {
        if (alive)
          setStatus({
            chainId: null,
            contractAddress: null,
            reachable: false,
            contractName: null,
            verificationCount: null,
            error: "status endpoint unreachable",
            checkedAt: new Date().toISOString(),
          });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!status) {
    return (
      <div className="studio-status">
        <span className="status-badge status-neutral">STUDIO NEXT · …</span>
        <span className="studio-status-note">checking chain</span>
      </div>
    );
  }

  if (!status.reachable) {
    return (
      <div className="studio-status">
        <span className="status-badge status-danger">STUDIO NEXT · OFFLINE</span>
        <span className="studio-status-note" title={status.error ?? undefined}>
          {status.error ?? "chain unreachable"}
        </span>
      </div>
    );
  }

  return (
    <div className="studio-status">
      <span className="status-badge status-success" title={status.contractName ?? undefined}>
        STUDIO NEXT · LIVE
      </span>
      <span className="studio-status-note">
        chain {status.chainId}
        {status.contractAddress ? (
          <>
            {" · "}
            <a
              href={`${EXPLORER}/address/${status.contractAddress}`}
              target="_blank"
              rel="noreferrer"
              className="studio-status-link"
            >
              {short(status.contractAddress)}
            </a>
          </>
        ) : null}
        {status.verificationCount !== null ? ` · ${status.verificationCount} stored` : ""}
        {` · checked ${new Date(status.checkedAt).toLocaleTimeString()}`}
      </span>
    </div>
  );
}
