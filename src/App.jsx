import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from './web3/hooks/useWallet';
import { useNetwork } from './web3/hooks/useNetwork';
import { useProfile } from './web3/hooks/useProfile';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { ritualTestnet } from './web3/chains';
import { CONTRACT_ADDRESSES, BRAIN_REGISTRY_ABI, BRAIN_PASS_ABI, XP_BADGE_ABI } from './web3/contracts';
import { toPng } from 'html-to-image';
import confetti from 'canvas-confetti';

// Viem public client for direct contract reads (used by the global leaderboard builder)
const publicClient = createPublicClient({
  chain: ritualTestnet,
  transport: http('https://rpc.ritualfoundation.org'),
});


export default function App() {
  // --- SPA Page Router State ---
  const [activePage, setActivePage] = useState('landing');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- Wallet Connection Modal Overlay ---
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // --- Profile Registration Form States ---
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileURI, setNewProfileURI] = useState('');

  // --- Toast Notification State ---
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = 'success', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  // --- On-chain Transaction State ---
  const [txState, setTxState] = useState({
    loading: false,
    hash: '',
    error: false,
    errorMessage: '',
    statusMessage: ''
  });

  // --- Verification On-chain Metadata ---
  const [verificationMetadata, setVerificationMetadata] = useState(null);

  // --- Web3 State Hooks ---
  const { address, balance, isBalanceLoading, isConnected, isConnecting, connect, disconnect: rawDisconnect, refetchBalance } = useWallet();
  const { switchChain, isWrongNetwork } = useNetwork();

  const disconnect = () => {
    rawDisconnect();
    addToast('Wallet disconnected.', 'info');
  };

  // --- Centralised profile state (single source of truth for all pages) ---
  const {
    profile,        // parsed plain-JS object with named fields; null when no profile
    hasProfile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useProfile(isConnected && !isWrongNetwork ? address : undefined);

  // --- Secondary on-chain reads (NFT pass & badges) ---
  const { data: passBalance, refetch: refetchPassBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.pass,
    abi: BRAIN_PASS_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: !!address && !isWrongNetwork },
  });

  const { data: passId, refetch: refetchPassId } = useReadContract({
    address: CONTRACT_ADDRESSES.pass,
    abi: BRAIN_PASS_ABI,
    functionName: 'userPassId',
    args: [address],
    query: { enabled: !!address && !isWrongNetwork && !!passBalance && passBalance > 0n },
  });

  const { data: badge1Balance, refetch: refetchBadge1 } = useReadContract({
    address: CONTRACT_ADDRESSES.badge,
    abi: XP_BADGE_ABI,
    functionName: 'balanceOf',
    args: [address, 1n],
    query: { enabled: !!address && !isWrongNetwork },
  });

  const { data: badge2Balance, refetch: refetchBadge2 } = useReadContract({
    address: CONTRACT_ADDRESSES.badge,
    abi: XP_BADGE_ABI,
    functionName: 'balanceOf',
    args: [address, 2n],
    query: { enabled: !!address && !isWrongNetwork },
  });

  const { data: badge3Balance, refetch: refetchBadge3 } = useReadContract({
    address: CONTRACT_ADDRESSES.badge,
    abi: XP_BADGE_ABI,
    functionName: 'balanceOf',
    args: [address, 3n],
    query: { enabled: !!address && !isWrongNetwork },
  });

  // --- Fetch all registered builder addresses from V2 contract ---
  const { data: registeredBuilders, refetch: refetchBuilders } = useReadContract({
    address: CONTRACT_ADDRESSES.registry,
    abi: BRAIN_REGISTRY_ABI,
    functionName: 'getRegisteredBuilders',
    query: { enabled: !isWrongNetwork },
  });

  /** Refetch everything after a confirmed transaction. */
  const refetchAllOnChainData = () => {
    refetchProfile();
    refetchPassBalance();
    refetchPassId();
    refetchBadge1();
    refetchBadge2();
    refetchBadge3();
    refetchBuilders();
    refetchBalance();
  };

  // --- Brain Scan Simulator States ---
  const [scanState, setScanState] = useState({
    inProgress: false,
    completed: false,
    traits: { analytical: 0, creative: 0, crypto: 0, empathy: 0 },
    mentalHash: ''
  });
  const [scanLogs, setScanLogs] = useState([
    { time: new Date().toLocaleTimeString([], { hour12: false }), message: 'Console active. Ready for neural architecture diagnostics.', type: 'system' },
    { time: new Date().toLocaleTimeString([], { hour12: false }), message: 'Awaiting wallet confirmation for signature matching...', type: 'system' }
  ]);
  const consoleBottomRef = useRef(null);

  // --- AI Mentor Chat States ---
  const [activeMentor, setActiveMentor] = useState('synthesizer');
  const [chatMessages, setChatMessages] = useState({
    synthesizer: [
      { sender: 'bot', text: 'Greetings, Builder. I am the Synthesizer neural agent. I have analyzed your repository node parameters. What computational architecture or system orchestration queries can I resolve for you today?' }
    ],
    cryptographer: [
      { sender: 'bot', text: 'Auditing channels initialized. I am the security agent. Share your script paths, contract layouts, or network hashes for cryptographic evaluation. Security is verification, not trust.' }
    ],
    notionist: [
      { sender: 'bot', text: 'Syntactician model synced. Let us review code complexity. What functions, stylesheets, or layouts are we refactoring today?' }
    ]
  });
  const [chatInput, setChatInput] = useState('');
  const [botTyping, setBotTyping] = useState(false);
  const chatBottomRef = useRef(null);

  // --- Builder Profile Card States ---
  // Initialized with empty/default values; hydrated from on-chain profile by useEffect.
  const [profileForm, setProfileForm] = useState({
    name: '',
    role: 'Cortex Integrator',
    bio: '',
    skills: {
      Solidity: true,
      Rust: true,
      PyTorch: true,
      'Next.js': true,
      WebAssembly: false,
      'ZK Circuits': false
    },
    metadataURI: '',
    xUsername: '',
    avatar: ''
  });

  // --- Share Achievement States ---
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCardUrl, setShareCardUrl] = useState('');
  const [shareCardLoading, setShareCardLoading] = useState(false);
  const [shareCardProgress, setShareCardProgress] = useState('');

  // --- Global Leaderboard States ---
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [sortAscending, setSortAscending] = useState(false);
  // Start empty — buildLeaderboard() populates this (including mock rows) on first run.
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // --- Real global leaderboard: fetch all registered builders from V2 + merge mock rows ---
  // Triggers ONLY when registeredBuilders list or network changes.
  // The connected wallet NEVER controls which builders are displayed; it only affects isUser highlighting.
  useEffect(() => {
    // Helper to parse a GFLOPS string safely
    const parseGflopsVal = (val) => {
      if (val === '--' || !val) return -1;
      return parseInt(val.toString().replace(/,/g, ''), 10);
    };

    // Static mock rows shown when real builder count is low (or chain is unavailable).
    const mockRows = [
      { name: 'Vitalik Notion',    role: 'ZKP Cryptographer',  sync: '98.4%', gflops: '849,201', hash: '0x3f5c...92be', isMock: true },
      { name: 'Guillermo Linear',  role: 'Cortex Integrator',  sync: '96.2%', gflops: '722,014', hash: '0x7e8a...02cd', isMock: true },
      { name: 'Amjad Apple',       role: 'Neural Architect',   sync: '94.8%', gflops: '652,800', hash: '0x1c9f...a801', isMock: true },
      { name: 'Ada Lovelace',      role: 'Neural Architect',   sync: '91.1%', gflops: '394,152', hash: '0x8f2d...d210', isMock: true },
      { name: 'Alan Turing',       role: 'ZKP Cryptographer',  sync: '89.5%', gflops: '281,409', hash: '0x6e2c...b195', isMock: true },
    ];

    async function buildLeaderboard() {
      setLeaderboardLoading(true);
      console.log("=========================================");
      console.log("[LEADERBOARD DEBUG] Refreshing leaderboard...");
      console.log("Connected wallet:", address || 'Disconnected');
      console.log("Active registry contract address:", CONTRACT_ADDRESSES.registry);

      let builderCount = 0n;
      try {
        builderCount = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.registry,
          abi: BRAIN_REGISTRY_ABI,
          functionName: 'getBuilderCount',
        });
        console.log("getBuilderCount() result:", builderCount.toString());
      } catch (err) {
        console.error("getBuilderCount() call failed:", err);
      }

      let fetchedAddresses = [];
      try {
        fetchedAddresses = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.registry,
          abi: BRAIN_REGISTRY_ABI,
          functionName: 'getRegisteredBuilders',
        });
        console.log("getRegisteredBuilders() result (full array):", fetchedAddresses);
      } catch (err) {
        console.error("getRegisteredBuilders() call failed:", err);
      }

      console.log("Hook registeredBuilders value:", registeredBuilders);

      let onChainRows = [];
      const builderAddresses = Array.isArray(fetchedAddresses) ? fetchedAddresses : [];

      try {
        for (const addr of builderAddresses) {
          try {
            const raw = await publicClient.readContract({
              address: CONTRACT_ADDRESSES.registry,
              abi: BRAIN_REGISTRY_ABI,
              functionName: 'getProfile',
              args: [addr],
            });
            console.log(`getProfile(${addr}) result:`, raw);

            if (!raw || !raw.exists) continue;

            const safeNum = (v, fb = 0) => {
              const n = Number(v);
              return Number.isFinite(n) ? n : fb;
            };

            const bs  = safeNum(raw.brainScore, 0);
            const lvl = safeNum(raw.level, 1);
            const xp  = safeNum(raw.xp, 0);
            const calcGflops = (bs * 1000) + (lvl * 5000) + (xp * 10);

            onChainRows.push({
              address:  addr,
              name:     raw.username || `Node ${addr.slice(0, 6)}`,
              role:     'Cortex Builder',
              sync:     bs > 0 ? `${bs}%` : 'Not Scanned',
              gflops:   calcGflops > 0 ? calcGflops.toLocaleString() : '--',
              hash:     `${addr.slice(0, 6)}...${addr.slice(-4)}`,
              isOnChain: true,
              isUser:   !!address && addr.toLowerCase() === address.toLowerCase(),
            });
          } catch (err) {
            console.warn('[LEADERBOARD] getProfile failed for', addr, err.message);
          }
        }
      } catch (rpcErr) {
        console.warn('[LEADERBOARD] RPC failure, falling back to mock data:', rpcErr.message);
        addToast('⚠️ Could not reach Ritual RPC. Showing placeholder data.', 'error');
      }

      const allRows = [...onChainRows, ...mockRows];
      allRows.sort((a, b) => parseGflopsVal(b.gflops) - parseGflopsVal(a.gflops));
      allRows.forEach((row, idx) => { row.rank = idx + 1; });

      console.log("Final leaderboard array before rendering:", allRows);
      console.log("=========================================");

      setLeaderboardData(allRows);
      setLeaderboardLoading(false);
    }

    buildLeaderboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredBuilders, isWrongNetwork, address]);







  // Load user's locally-saved verified proof hash on wallet connect
  useEffect(() => {
    if (address) {
      const cachedHash = localStorage.getItem(`mentalHash_${address.toLowerCase()}`);
      if (cachedHash) {
        setScanState(prev => ({
          ...prev,
          mentalHash: cachedHash,
          completed: true
        }));
        addScanLog(`Verification records identified. Local Proof Hash loaded: ${cachedHash.slice(0, 10)}...${cachedHash.slice(-8)}`, 'system');
      }
    }
  }, [address]);

  // --- Navigation Helpers ---
  const handlePageChange = (pageId) => {
    setActivePage(pageId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Wallet Connection Wrapper ---
  const handleConnectWallet = async (providerId) => {
    try {
      await connect(providerId);
      setWalletModalOpen(false);
      addToast('Wallet connected!', 'success');
    } catch (err) {
      console.error('Wallet connection failed:', err);
      addToast('Connection failed: Ensure extension is unlocked.', 'error');
      setWalletModalOpen(false);
    }
  };

  const shortAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  // Log Web3 network changes to terminal
  useEffect(() => {
    if (isConnected && address) {
      addScanLog(`Wallet connected. Sync Address: ${address}`, 'system');
      if (isWrongNetwork) {
        addScanLog('[WARNING] Unsupported chain detected. Please switch network.', 'error');
      } else {
        addScanLog('Connected to Ritual Testnet (Chain ID: 1979). Sync status: OK.', 'system');
        refetchAllOnChainData();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, isWrongNetwork]);

  // --- Contract Interaction Actions ---
  const { writeContractAsync: writeRegistryContract } = useWriteContract();

  // Wait for every submitted transaction and refetch profile on confirmation
  const { data: txReceipt, isSuccess: txSuccess, isError: waitError, error: waitErrorData } = useWaitForTransactionReceipt({
    hash: txState.hash,
    query: { enabled: !!txState.hash },
  });

  useEffect(() => {
    if (txSuccess && txReceipt) {
      const msgLower = txState.statusMessage.toLowerCase();
      const isVerifyTx = msgLower.includes('brain score');
      const isCreateTx = msgLower.includes('creation');

      setTxState(prev => ({ ...prev, loading: false, statusMessage: 'Transaction confirmed! 🎉' }));

      if (isVerifyTx) {
        const meta = {
          hash:        txReceipt.transactionHash,
          blockNumber: txReceipt.blockNumber.toString(),
          timestamp:   new Date().toLocaleString(),
          success:     txReceipt.status === 'success',
        };
        setVerificationMetadata(meta);
        addToast('Brain scan verified on-chain!', 'success');
      } else {
        addToast(isCreateTx ? 'Profile created!' : 'Profile updated!', 'success');
      }

      // Refetch all on-chain state so every page re-renders with real data
      refetchAllOnChainData();
    }
    if (waitError) {
      setTxState(prev => ({
        ...prev,
        loading: false,
        error: true,
        errorMessage: waitErrorData?.message || 'Transaction execution failed.',
      }));
      addToast('Transaction execution failed.', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txSuccess, txReceipt, waitError]);

  const lastLoadedAddress = useRef('');
  const lastLoadedTxHash = useRef('');

  // Sync profile card form whenever on-chain profile data arrives / changes
  useEffect(() => {
    if (!hasProfile || !profile || !address) return;

    const isNewAddress = lastLoadedAddress.current !== address.toLowerCase();
    const isNewTx = txReceipt && lastLoadedTxHash.current !== txReceipt.transactionHash;

    if (isNewAddress || isNewTx) {
      lastLoadedAddress.current = address.toLowerCase();
      if (txReceipt) {
        lastLoadedTxHash.current = txReceipt.transactionHash;
      }

      // Read local storage for avatar and X username
      const localAvatar = localStorage.getItem(`cortex_avatar_${address.toLowerCase()}`) || '';
      const localXUser = localStorage.getItem(`cortex_x_username_${address.toLowerCase()}`) || '';
      setShareCardUrl(''); // Reset compiled share card on wallet change

      setProfileForm(prev => ({
        ...prev,
        name: profile.username || prev.name,
        metadataURI: profile.metadataURI || prev.metadataURI,
        xUsername: localXUser,
        avatar: localAvatar,
      }));

      // If metadataURI points to a JSON endpoint, hydrate role/bio/skills
      if (profile.metadataURI && (profile.metadataURI.startsWith('http') || profile.metadataURI.startsWith('https'))) {
        fetch(profile.metadataURI)
          .then(res => res.json())
          .then(json => {
            setProfileForm(prev => ({
              ...prev,
              role:   json.role   || prev.role,
              bio:    json.bio    || prev.bio,
              skills: json.skills || prev.skills,
            }));
          })
          .catch(err => console.warn('Failed to fetch profile metadata JSON:', err));
      }
    }
  }, [hasProfile, profile, address, txReceipt]);

  // Call createProfile on BrainRegistry
  const handleCreateProfileSubmit = async () => {
    if (!newProfileName.trim()) {
      addToast("Username alias cannot be empty", "error");
      return;
    }
    setTxState({
      loading: true,
      hash: '',
      error: false,
      errorMessage: '',
      statusMessage: 'Awaiting signature in wallet...'
    });

    try {
      const targetURI = newProfileURI.trim() || `https://api.ritualbrain.net/profiles/${address.toLowerCase()}.json`;
      const hash = await writeRegistryContract({
        address: CONTRACT_ADDRESSES.registry,
        abi: BRAIN_REGISTRY_ABI,
        functionName: 'createProfile',
        args: [newProfileName.trim(), targetURI],
      });
      setTxState(prev => ({ ...prev, hash, statusMessage: 'Profile creation submitted. Awaiting block confirmation...' }));
    } catch (err) {
      console.error('Create profile failed:', err);
      const isRejected = err.message && (err.message.includes('User rejected') || err.message.includes('UserDenied'));
      setTxState({ loading: false, hash: '', error: true, errorMessage: isRejected ? 'Signature rejected.' : (err.shortMessage || err.message), statusMessage: '' });
      addToast(isRejected ? 'Request rejected.' : 'Profile creation failed.', 'error');
    }
  };

  // Call updateProfile on BrainRegistry
  const handleUpdateProfileSubmit = async (e) => {
    if (e) e.preventDefault();
    setTxState({
      loading: true,
      hash: '',
      error: false,
      errorMessage: '',
      statusMessage: 'Awaiting signature in wallet to update credentials...'
    });

    try {
      const targetURI = profileForm.metadataURI.trim() || `https://api.ritualbrain.net/profiles/${address.toLowerCase()}.json`;
      const hash = await writeRegistryContract({
        address: CONTRACT_ADDRESSES.registry,
        abi: BRAIN_REGISTRY_ABI,
        functionName: 'updateProfile',
        args: [profileForm.name, targetURI],
      });
      setTxState(prev => ({ ...prev, hash, statusMessage: 'Update submitted. Waiting for confirmation...' }));
    } catch (err) {
      console.error('Update profile failed:', err);
      const isRejected = err.message && (err.message.includes('User rejected') || err.message.includes('UserDenied'));
      setTxState({ loading: false, hash: '', error: true, errorMessage: isRejected ? 'Signature rejected.' : (err.shortMessage || err.message), statusMessage: '' });
      addToast(isRejected ? 'Request rejected.' : 'Profile update failed.', 'error');
    }
  };

  // General user action to self-verify score on-chain
  const handleVerifyScan = async () => {
    if (!scanState.completed) {
      addToast("Please complete a Brain Scan first.", "error");
      return;
    }
    const avgScore = Math.round((scanState.traits.analytical + scanState.traits.creative + scanState.traits.crypto + scanState.traits.empathy) / 4);

    setTxState({
      loading: true,
      hash: '',
      error: false,
      errorMessage: '',
      // IMPORTANT: this message is used by the receipt effect to detect isVerifyTx.
      // It must contain 'brain score' (lowercase) — keep consistent with the includes() check.
      statusMessage: 'Awaiting signature to verify brain score on-chain...'
    });

    try {
      const hash = await writeRegistryContract({
        address: CONTRACT_ADDRESSES.registry,
        abi: BRAIN_REGISTRY_ABI,
        functionName: 'updateBrainScore',
        args: [address, BigInt(avgScore)]
      });

      // Save generated proof hash locally in localStorage
      localStorage.setItem(`mentalHash_${address.toLowerCase()}`, scanState.mentalHash);

      // IMPORTANT: keep 'brain score' (lowercase) so the receipt effect detects isVerifyTx.
      setTxState(prev => ({
        ...prev,
        hash,
        statusMessage: 'brain score update submitted. Awaiting block confirmation...'
      }));
    } catch (err) {
      console.error("Self-verify failed:", err);
      const isRejected = err.message && (err.message.includes("User rejected") || err.message.includes("UserDenied"));
      setTxState({
        loading: false,
        hash: '',
        error: true,
        errorMessage: isRejected ? "Signature request rejected by user." : (err.shortMessage || err.message),
        statusMessage: ''
      });
      addToast(isRejected ? "Request rejected." : "Verification failed.", "error");
    }
  };

  // --- Dynamic Dashboard Canvas Graph ---
  const canvasRef = useRef(null);
  useEffect(() => {
    if (activePage !== 'dashboard' || isWrongNetwork || !isConnected || !hasProfile) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth * window.devicePixelRatio;
      canvas.height = parent.clientHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const nodes = [];
    const totalNodes = 12;

    for (let i = 0; i < totalNodes; i++) {
      nodes.push({
        x: Math.random() * (canvas.width / window.devicePixelRatio - 40) + 20,
        y: Math.random() * (canvas.height / window.devicePixelRatio - 40) + 20,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 3 + 2,
        pulse: Math.random() * Math.PI
      });
    }

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, w, h);

      // Links mesh
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 140) {
            const alpha = (1 - dist / 140) * 0.15;
            ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Nodes vector
      nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 10 || n.x > w - 10) n.vx *= -1;
        if (n.y < 10 || n.y > h - 10) n.vy *= -1;

        n.pulse += 0.02;
        const currentRadius = n.radius + Math.sin(n.pulse) * 1.5;

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#8b5cf6';
        ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });

      // Scan sweeping laser line
      const sweepX = (Date.now() * 0.1) % (w + 200) - 100;
      const grad = ctx.createLinearGradient(sweepX - 60, 0, sweepX, 0);
      grad.addColorStop(0, 'rgba(59, 130, 246, 0)');
      grad.addColorStop(1, 'rgba(59, 130, 246, 0.18)');
      ctx.fillStyle = grad;
      ctx.fillRect(sweepX - 60, 0, 60, h);

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sweepX, 0);
      ctx.lineTo(sweepX, h);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activePage, isWrongNetwork, isConnected, hasProfile]);

  // --- Interactive Holographic 3D Card Hover ---
  const cardRef = useRef(null);
  useEffect(() => {
    const card = cardRef.current;
    if (!card || activePage !== 'profile') return;

    const handleMouseMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const tiltX = ((y / rect.height) - 0.5) * -18; // cap tilt degrees
      const tiltY = ((x / rect.width) - 0.5) * 18;

      card.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
      card.style.borderColor = 'rgba(139, 92, 246, 0.4)';
      card.style.boxShadow = `
        0 25px 50px rgba(0, 0, 0, 0.7),
        ${-tiltY * 1.5}px ${tiltX * 1.5}px 30px rgba(139, 92, 246, 0.1),
        inset 0 0 20px rgba(255, 255, 255, 0.05)
      `;
    };

    const handleMouseLeave = () => {
      card.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
      card.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      card.style.boxShadow = '';
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [activePage]);

  // --- Brain Scan Controller Logic ---
  const addScanLog = (msg, type = 'system') => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setScanLogs(prev => [...prev, { time, message: msg, type }]);
  };

  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scanLogs]);

  const handleStartScan = () => {
    if (scanState.inProgress) return;

    setScanState(prev => ({ ...prev, inProgress: true, completed: false }));
    addScanLog('Initializing brain scanner sequence...', 'system');

    // Step 1 calibration
    setTimeout(() => {
      addScanLog('Synapse calibration sequence loaded.', 'system');
      addScanLog('Latency checks: OK (12ms nodes, 4ms consensus).', 'system');
    }, 900);

    // Step 2 map coords
    setTimeout(() => {
      addScanLog('Mapping synapse coordinates (Target density: ~100B junctions)...', 'system');
      addScanLog('Synapse densities calculated: High density in Frontal Lobe.', 'system');
    }, 1800);

    // Step 3 secure encryption keys
    setTimeout(() => {
      addScanLog('Running zero-knowledge cryptographic signature compilation...', 'system');
      addScanLog('Generating mental hash value tags...', 'system');
    }, 2800);

    // Step 4 final score calculations
    setTimeout(() => {
      addScanLog('Mapping complete. Synaptic data encrypted and indexed.', 'system');

      const traits = {
        analytical: Math.floor(Math.random() * 15 + 83),
        creative: Math.floor(Math.random() * 18 + 79),
        crypto: Math.floor(Math.random() * 13 + 86),
        empathy: Math.floor(Math.random() * 20 + 75)
      };

      // Generate a mock hash
      const letters = '0123456789abcdef';
      let hash = '0x';
      for (let i = 0; i < 64; i++) {
        hash += letters[Math.floor(Math.random() * 16)];
      }

      setScanState({
        inProgress: false,
        completed: true,
        traits,
        mentalHash: hash
      });
      addToast("Brain mapping complete!", "success");
    }, 4200);
  };

  const handleSaveScanToProfile = () => {
    if (!scanState.completed) return;
    const avg = ((scanState.traits.analytical + scanState.traits.creative + scanState.traits.crypto + scanState.traits.empathy) / 4).toFixed(1);
    addToast(`Synaptic mapping scores synced! (Sync: ${avg}%)`, 'success');
  };

  const handleMintProofCard = () => {
    if (!scanState.completed) {
      addToast('Please complete a Brain Scan first.', 'error');
      return;
    }
    if (!verificationMetadata) {
      addToast('Please verify your scan on-chain first.', 'error');
      return;
    }
    addToast('Brain Pass NFT proof card minted! 🎉', 'success');
  };

  // --- AI Mentor Chat Prompts Handler ---
  const mentorDialogs = {
    synthesizer: {
      name: 'The Synthesizer',
      role: '— Cross-Disciplinary Architect',
      responses: {
        default: 'An interesting system layout choice. When dealing with high-throughput node data, I highly recommend packaging computation logic into secure off-chain WASM templates, then returning verified output proofs back to the Ritual Consensus node.',
        hello: 'Hello engineer. The network remains fully operational. How can I assist in refining your system blueprints today?',
        architecture: 'When designing modular architectures, ensure the separation of validation states. Offload high-density data parsing to decentralized CPU/GPU node groups, using consensus layers primarily for proof alignment.',
        compute: 'Compute pools inside Ritual utilize peer-to-peer execution stacks. The latency depends heavily on the chosen node location and availability of GPU cores. Make sure to implement retry layers in your client fetch queries.'
      }
    },
    cryptographer: {
      name: 'The Cryptographer',
      role: '— Security Auditor Agent',
      responses: {
        default: 'Under cryptography frameworks, data must remain completely hidden. I recommend implementing Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge (zk-SNARKs) to prove cognitive output validity without exposing weights.',
        hello: 'Auditor active. Direct your security inquiries. Ensure your private key configurations are locked away from code files.',
        wallet: 'Never expose API variables or raw private key strings. Always handle authentication headers dynamically, signing connections only via standard web3 provider hooks (like MetaMask or Coinbase Wallet).',
        security: 'Analyzing contract vulnerabilities: ensure all external contract loops are protected against reentrancy vectors. If pulling model parameters off-chain, sign the hash block using RSA-256 protocols.',
        hash: 'Cryptographic hashes are immutable. The brain scans are validated on-chain via custom Poseidon hashes, which are heavily optimized for zero-knowledge circuit mapping verification.'
      }
    },
    notionist: {
      name: 'The Syntactician',
      role: '— Clean Code Optimizer',
      responses: {
        default: 'To maintain sleek UX similar to Linear or Vercel, replace bulky UI dependencies with custom CSS variables, layout grids, and requestAnimationFrame canvas rendering. Fast load speed increases performance scores by up to 40%.',
        hello: 'Optimization console active. What script files are we clean-coding today?',
        javascript: 'Avoid nested callbacks in asynchronous Javascript. Package fetch operations into modern async/await routines with explicit try/catch loops. This guarantees a clean debugger log stack.',
        css: 'Clean styles require a modular layout. Utilize relative units like rem/em, implement viewport clamp properties for headers, and bundle repetitive glassmorphism styles under a single utility class.',
        code: 'Code density is vital. Refactor redundant statements into generic mapping helpers. Keep functions under 25 lines, making them self-documenting and easier to test.'
      }
    }
  };

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, botTyping]);

  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || botTyping) return;

    const userText = chatInput.trim();
    setChatInput('');

    // Append user bubble
    setChatMessages(prev => ({
      ...prev,
      [activeMentor]: [...prev[activeMentor], { sender: 'user', text: userText }]
    }));

    setBotTyping(true);

    // Bot calculates response
    setTimeout(() => {
      setBotTyping(false);
      const mentor = mentorDialogs[activeMentor];
      const lower = userText.toLowerCase();
      let reply = mentor.responses.default;

      if (lower.includes('hello') || lower.includes('hey') || lower.includes('hi')) {
        reply = mentor.responses.hello;
      } else if (lower.includes('architecture') || lower.includes('design') || lower.includes('structure')) {
        reply = mentor.responses.architecture || mentor.responses.default;
      } else if (lower.includes('compute') || lower.includes('gpu') || lower.includes('power')) {
        reply = mentor.responses.compute || mentor.responses.default;
      } else if (lower.includes('ritual') || lower.includes('cortex')) {
        reply = mentor.responses.ritual || mentor.responses.default;
      } else if (lower.includes('wallet') || lower.includes('connect')) {
        reply = mentor.responses.wallet || mentor.responses.default;
      } else if (lower.includes('security') || lower.includes('hack') || lower.includes('vulnerability')) {
        reply = mentor.responses.security || mentor.responses.default;
      } else if (lower.includes('hash') || lower.includes('signature') || lower.includes('proof')) {
        reply = mentor.responses.hash || mentor.responses.default;
      } else if (lower.includes('javascript') || lower.includes('js') || lower.includes('react')) {
        reply = mentor.responses.javascript || mentor.responses.default;
      } else if (lower.includes('css') || lower.includes('style') || lower.includes('theme')) {
        reply = mentor.responses.css || mentor.responses.default;
      } else if (lower.includes('code') || lower.includes('clean') || lower.includes('refactor')) {
        reply = mentor.responses.code || mentor.responses.default;
      }

      setChatMessages(prev => ({
        ...prev,
        [activeMentor]: [...prev[activeMentor], { sender: 'bot', text: reply }]
      }));
    }, 1300);
  };

  // --- Profile Card Sync Engine (Local View Update) ---
  const handleProfileFormChange = (key, val) => {
    setProfileForm(prev => {
      const updated = { ...prev, [key]: val };
      if (key === 'xUsername' && address) {
        localStorage.setItem(`cortex_x_username_${address.toLowerCase()}`, val);
        setShareCardUrl(''); // Invalidate cache
      }
      return updated;
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result;
        setProfileForm(prev => ({ ...prev, avatar: base64Data }));
        if (address) {
          localStorage.setItem(`cortex_avatar_${address.toLowerCase()}`, base64Data);
          setShareCardUrl(''); // Invalidate cache
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSkillToggle = (skill) => {
    setProfileForm(prev => ({
      ...prev,
      skills: { ...prev.skills, [skill]: !prev.skills[skill] }
    }));
  };

  // --- Share Card Generation and Action Handlers ---
  const handleOpenShareModal = () => {
    setShareModalOpen(true);
    if (!shareCardUrl) {
      generateShareCard();
    }
  };

  const generateShareCard = async () => {
    setShareCardLoading(true);
    setShareCardProgress('Initializing canvas compilation...');
    
    await new Promise(r => setTimeout(r, 600));

    const element = document.getElementById('achievement-card-ref');
    if (!element) {
      setShareCardLoading(false);
      addToast('Error: Offscreen card element not found.', 'error');
      return;
    }

    try {
      setShareCardProgress('Rendering holographic textures...');
      await new Promise(r => setTimeout(r, 400));

      setShareCardProgress('Rasterizing vector graphics...');
      const dataUrl = await toPng(element, {
        width: 1200,
        height: 675,
        cacheBust: true,
      });

      setShareCardUrl(dataUrl);
      setShareCardLoading(false);
      
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#3b82f6', '#ec4899', '#ffffff']
      });
      
      addToast('Achievement card compiled successfully!', 'success');
    } catch (err) {
      console.error('Card generation failed:', err);
      setShareCardLoading(false);
      addToast('Failed to generate achievement card.', 'error');
    }
  };

  const handleDownloadCard = () => {
    if (!shareCardUrl) return;
    const link = document.createElement('a');
    link.download = `ritual_achievement_${address.slice(0, 6)}.png`;
    link.href = shareCardUrl;
    link.click();
    addToast('Card PNG downloaded successfully!', 'success');
  };

  const handleShareOnX = () => {
    if (!shareCardUrl) return;
    
    handleDownloadCard();

    const gflopsVal = (liveBrainScore * 1000) + (liveLevel * 5000) + (liveXP * 10);
    const text = `🧠 I just verified my Builder Identity on Ritual Brain!\n\n⚡ Brain Score: ${liveBrainScore}%\n🚀 GFLOPS: ${gflopsVal > 0 ? gflopsVal.toLocaleString() : '--'}\n🏆 Level: ${liveLevel}\n\nBuilt on Ritual Testnet.\nCan you beat my score?\n\nhttps://ritual-cortex-wine.vercel.app/\n\n#Ritual #BuildOnRitual #AI #Web3`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank');

    addToast('Your achievement card has been downloaded. Attach it to your X post and publish!', 'success', 8000);
  };

  const profileInitials = profileForm.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ? w[0].toUpperCase() : '')
    .join('');

  // --- Leaderboard Operations ---
  const handleSortLeaderboard = (column) => {
    setSortAscending(!sortAscending);

    setLeaderboardData(prev => {
      const copy = [...prev];
      copy.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        if (column === 'gflops') {
          valA = (valA === '--' || !valA) ? -1 : parseInt(valA.toString().replace(/,/g, ''), 10);
          valB = (valB === '--' || !valB) ? -1 : parseInt(valB.toString().replace(/,/g, ''), 10);
        } else if (column === 'sync') {
          valA = (valA === 'Not Scanned' || valA === '--' || !valA) ? -1 : parseFloat(valA.toString().replace(/%/g, ''));
          valB = (valB === 'Not Scanned' || valB === '--' || !valB) ? -1 : parseFloat(valB.toString().replace(/%/g, ''));
        } else if (column === 'rank') {
          valA = parseInt(valA || '0', 10);
          valB = parseInt(valB || '0', 10);
        }

        if (valA < valB) return sortAscending ? -1 : 1;
        if (valA > valB) return sortAscending ? 1 : -1;
        return 0;
      });
      return copy;
    });
  };

  const filteredLeaderboard = leaderboardData.filter(row => {
    const q = leaderboardSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (row.name  || '').toLowerCase().includes(q) ||
      (row.role  || '').toLowerCase().includes(q) ||
      (row.hash  || '').toLowerCase().includes(q)
    );
  });

  // Reusable lock overlay for unregistered users
  const renderProfileLockedView = () => {
    return (
      <div className="glass-panel dashboard-locked" style={{ display: 'flex', margin: '40px auto', maxWidth: '600px', padding: '36px', flexDirection: 'column', alignItems: 'center' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8b5cf6', width: '56px', height: '56px', marginBottom: '16px' }}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <h3>Neural Identity Required</h3>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.92rem', marginBottom: '20px', lineHeight: '1.5' }}>
          Your wallet is connected, but you have not registered your profile on the BrainRegistry smart contract yet. Initialize your credentials to mint your dynamic Brain Pass NFT.
        </p>
        
        {txState.loading ? (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div className="connecting-spinner" style={{ margin: '0 auto 12px' }}></div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{txState.statusMessage}</span>
            {txState.hash && (
              <p style={{ marginTop: '8px', fontSize: '0.8rem' }}>
                Tx Hash: <a href={`https://explorer.ritualfoundation.org/tx/${txState.hash}`} target="_blank" rel="noreferrer" className="explorer-link" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{txState.hash.slice(0, 10)}...{txState.hash.slice(-8)}</a>
              </p>
            )}
          </div>
        ) : showRegisterForm ? (
          <div className="glass-card" style={{ width: '100%', maxWidth: '360px', padding: '20px', textAlign: 'left', border: '1px solid rgba(139,92,246,0.2)' }}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '4px', display: 'block' }}>Username Alias</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. SatoshiCortex" 
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '4px', display: 'block' }}>Metadata URI Link</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. https://api.ritualbrain.net/profiles/user.json" 
                value={newProfileURI}
                onChange={(e) => setNewProfileURI(e.target.value)}
              />
            </div>
            {txState.error && (
              <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px', lineHeight: '1.4' }}>
                Error: {txState.errorMessage}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowRegisterForm(false)} style={{ flex: 1, height: '38px', padding: 0 }}>Cancel</button>
              <button className="btn btn-primary btn-glow" onClick={handleCreateProfileSubmit} style={{ flex: 2, height: '38px', padding: 0 }}>Create Profile</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-primary btn-glow" onClick={() => { setShowRegisterForm(true); setTxState({ loading: false, hash: '', error: false, errorMessage: '', statusMessage: '' }); }}>
            Create Brain Profile
          </button>
        )}
      </div>
    );
  };

  // Loader while profile is fetching from chain
  if (isConnected && !isWrongNetwork && profileLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#03000a', gap: '20px' }}>
        <img 
          src="/logo.png" 
          alt="Ritual Brain Logo" 
          style={{ 
            width: '80px', 
            height: '80px', 
            objectFit: 'contain', 
            filter: 'drop-shadow(0 0 15px rgba(139, 92, 246, 0.5))',
            animation: 'pulse 2s ease-in-out infinite alternate' 
          }} 
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div className="connecting-spinner"></div>
          <span style={{ fontFamily: 'var(--font-tech)', color: 'var(--text-secondary)', letterSpacing: '1px', fontSize: '0.85rem' }}>Synchronizing Neural Core State...</span>
        </div>
      </div>
    );
  }

  // --- Live values: read directly from decoded profile (all plain JS numbers, never NaN) ---
  // profile is null when no profile exists; fall back to safe defaults.
  const liveXP         = profile?.xp          ?? 0;   // already a plain number from useProfile
  const liveLevel      = profile?.level        ?? 1;
  const liveBrainScore = profile?.brainScore   ?? 0;

  const _joinTs = profile?.joinTimestamp ?? 0;  // already seconds as a plain number
  const liveJoinDate = _joinTs > 0
    ? new Date(_joinTs * 1000).toLocaleDateString()
    : 'N/A';

  // Badges are still raw BigInt from ERC1155 balanceOf — keep as BigInt for comparisons
  const liveBadge1 = badge1Balance ?? 0n;
  const liveBadge2 = badge2Balance ?? 0n;
  const liveBadge3 = badge3Balance ?? 0n;
  const livePassId = passId ?? null;

  return (
    <>
      {/* Toast Notifications Overlay Container */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(t => (
          <div key={t.id} className="glass-card" style={{ padding: '12px 20px', borderLeft: `4px solid ${t.type === 'success' ? '#10b981' : t.type === 'error' ? '#ef4444' : '#8b5cf6'}`, background: 'rgba(10, 5, 20, 0.92)', backdropFilter: 'blur(10px)', color: '#fff', fontSize: '0.82rem', minWidth: '260px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Background Ambient Effects */}
      <div className="ambient-glows">
        <div className="glow-purple"></div>
        <div className="glow-blue"></div>
      </div>

      {/* Header Navigation */}
      <header>
        <div className="container nav-wrapper">
          <a href="#" className="logo" onClick={(e) => { e.preventDefault(); handlePageChange('landing'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/logo.png" alt="Ritual Brain Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span>Ritual Brain</span>
          </a>

          {/* Page Links */}
          <nav>
            <ul className={`nav-links ${mobileMenuOpen ? 'active' : ''}`}>
              <li><a onClick={() => handlePageChange('landing')} className={activePage === 'landing' ? 'active' : ''}>Features</a></li>
              <li><a onClick={() => handlePageChange('dashboard')} className={activePage === 'dashboard' ? 'active' : ''}>Dashboard</a></li>
              <li><a onClick={() => handlePageChange('scan')} className={activePage === 'scan' ? 'active' : ''}>Brain Scan</a></li>
              <li><a onClick={() => handlePageChange('mentor')} className={activePage === 'mentor' ? 'active' : ''}>AI Mentor</a></li>
              <li><a onClick={() => handlePageChange('profile')} className={activePage === 'profile' ? 'active' : ''}>Builder Profile</a></li>
              <li><a onClick={() => handlePageChange('leaderboard')} className={activePage === 'leaderboard' ? 'active' : ''}>Leaderboard</a></li>
            </ul>
          </nav>

          {/* Connection Actions */}
          <div className="nav-actions">
            {isConnected ? (
              isWrongNetwork ? (
                <button onClick={switchChain} className="btn" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.35)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  <span>Switch Network</span>
                </button>
              ) : (
                <div className="wallet-pill" onClick={disconnect} title="Click to disconnect wallet">
                  <span className="wallet-dot" style={{ backgroundColor: '#8b5cf6' }}></span>
                  <span>{shortAddress}</span>
                </div>
              )
            ) : (
              <button className="btn btn-secondary btn-glow" onClick={() => setWalletModalOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Connect Wallet</span>
              </button>
            )}
            
            <button className="mobile-nav-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main View Container */}
      <main className="container" style={{ paddingTop: '20px' }}>
        
        {/* Wrong Network Header Alert Banner */}
        {isConnected && isWrongNetwork && (
          <div className="network-warning-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span><strong>Wrong Network:</strong> Ritual Brain requires the Ritual Testnet. Switch your wallet network to continue syncing nodes.</span>
            </div>
            <button onClick={switchChain} className="btn-switch">Switch to Ritual Testnet</button>
          </div>
        )}

        {/* 1. LANDING PAGE */}
        <section id="landing" className={`page-section ${activePage === 'landing' ? 'active show' : ''}`}>
          <div className="hero">
            <div className="hero-badge">
              <span className="hero-badge-dot"></span>
              <span>Ritual Testnet Integration Online</span>
            </div>
            <h1>Synergize Your Neural Architecture with <span className="gradient-text">Ritual Brain</span></h1>
            <p>The premium developer interface for cognitive verification, compute distribution, and AI mentorship. Mint your neural signature, monetize idle compute, and align your skills on-chain.</p>
            <div className="hero-ctas">
              <button className="btn btn-primary btn-glow" onClick={() => handlePageChange('scan')}>
                Initialize Brain Scan
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
              <button className="btn btn-secondary" onClick={() => handlePageChange('mentor')}>Explore AI Mentors</button>
            </div>
            
            <div className="hero-visual">
              <div className="hero-brain-globe">
                <img 
                  src="/logo.png" 
                  alt="Ritual Brain Hero Logo" 
                  style={{ 
                    position: 'absolute', 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%)', 
                    width: '160px', 
                    height: '160px', 
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 25px rgba(139, 92, 246, 0.6))',
                    animation: 'pulse 4s ease-in-out infinite alternate',
                    zIndex: 2 
                  }} 
                />
                <div className="brain-core"></div>
                <div className="brain-ring"></div>
                <div className="brain-ring-inner"></div>
                <div className="brain-nodes">
                  <div className="brain-node"></div>
                  <div className="brain-node"></div>
                  <div className="brain-node"></div>
                  <div className="brain-node"></div>
                  <div className="brain-node"></div>
                  <div className="brain-node"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="section-title-area">
            <h2>Cognitive Utilities for Builders</h2>
            <p>A sophisticated network structure hosting developer-native tooling, cryptography, and model interfaces.</p>
          </div>

          <div className="features-grid">
            <div className="glass-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <h3 className="feature-title">Cognitive Verification</h3>
              <p>Secure cryptographic brain scans assessing neural traits (Logic, Cryptography, Empathetic Synthesis) to generate an immutable, verified mental hash for your builder ID.</p>
            </div>

            <div className="glass-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              </div>
              <h3 className="feature-title">Decentralized Compute Pools</h3>
              <p>Unlock localized execution. Contribute idle GPU/CPU capacity to execute inference networks in peer-to-peer cognitive clusters, accumulating on-chain network rewards.</p>
            </div>

            <div className="glass-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="feature-title">Dynamic AI Mentorship</h3>
              <p>Consult synthesized custom AI agents modeled after elite software architects and security cryptographers. Receive feedback, code reviews, and tactical assistance.</p>
            </div>
          </div>

          <div className="how-it-works">
            <div className="section-title-area">
              <h2>The Synthesis Journey</h2>
              <p>Unlock the latent capacity of decentralized nodes and human intellect in three operations.</p>
            </div>

            <div className="steps-container">
              <div className="glass-card step-card">
                <div className="step-num">01</div>
                <h3 className="feature-title">Neural Mapping</h3>
                <p>Perform the localized brain scan simulation, capturing biometric response logs and calculating primary cognitive architectures.</p>
              </div>
              <div className="glass-card step-card">
                <div className="step-num">02</div>
                <h3 className="feature-title">Generate proof</h3>
                <p>Compile mapping results into an on-chain Proof of Intellect. Generate a cryptographically secure hash identifier matching your wallet address.</p>
              </div>
              <div className="glass-card step-card">
                <div className="step-num">03</div>
                <h3 className="feature-title">Activate Core</h3>
                <p>Gain absolute access to compute dashboards, personalized mentor prompts, and high-rank slots in global builder networks.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. DASHBOARD */}
        <section id="dashboard" className={`page-section ${activePage === 'dashboard' ? 'active show' : ''}`}>
          <div className="section-title-area">
            <h2>Neural Operations Dashboard</h2>
            <p>Real-time telemetry of node connections, network computational speed, and node sync status.</p>
          </div>

          {/* Locked Overlays */}
          {!isConnected ? (
            <div className="glass-panel dashboard-locked" style={{ display: 'flex' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <h3>Authentication Required</h3>
              <p>Connect your Web3 cryptographic wallet to decrypt neural logs, monitor active compute node pools, and verify synaptics.</p>
              <button className="btn btn-primary btn-glow" onClick={() => setWalletModalOpen(true)}>Connect Wallet</button>
            </div>
          ) : isWrongNetwork ? (
            <div className="glass-panel dashboard-locked" style={{ display: 'flex' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ef4444' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <h3>Ritual Network Required</h3>
              <p>Your wallet is currently linked to an unsupported network. Switch to the Ritual Testnet to sync node telemetry and retrieve balance details.</p>
              <button onClick={switchChain} className="btn btn-primary btn-glow">Switch to Ritual Testnet</button>
            </div>
          ) : !hasProfile ? (
            renderProfileLockedView()
          ) : (
            <div className="dashboard-unlocked">
              <div className="dashboard-grid">
                <div className="dashboard-main">
                  <div className="dashboard-stats">
                    <div className="glass-card stat-item">
                      <span className="stat-label">Dynamic GFLOPS</span>
                      <span className="stat-value">{(liveBrainScore * 35.5).toFixed(1)}</span>
                      <span className="stat-trend trend-up">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                        Calculated from Brain Score
                      </span>
                    </div>
                    <div className="glass-card stat-item">
                      <span className="stat-label">Active Nodes</span>
                      <span className="stat-value">{liveLevel * 2} Nodes</span>
                      <span className="stat-trend trend-up">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                        Linked to Level {liveLevel}
                      </span>
                    </div>
                    <div className="glass-card stat-item">
                      <span className="stat-label">Real RITUAL Balance</span>
                      <span
                        className="stat-value"
                        style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                        title={balance ?? 'Fetching balance...'}
                      >
                        {/* balance is null while loading or when Wagmi cannot format the value.
                            Never call .split() on null — show 'Loading...' as a safe fallback.
                            When ready, balance = '0.1248 RITUAL' so split(' ')[0] = '0.1248'. */}
                        {isBalanceLoading
                          ? 'Loading...'
                          : balance != null
                            ? `${balance.split(' ')[0]} RITUAL`
                            : 'Loading...'}
                      </span>
                      <span className="stat-trend trend-up">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                        Live Testnet balance
                      </span>
                    </div>
                    <div className="glass-card stat-item">
                      <span className="stat-label">Consensus Trust</span>
                      <span className="stat-value">{(90 + liveBrainScore * 0.1).toFixed(2)}%</span>
                      <span className="stat-trend trend-up">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                        Verification index
                      </span>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '8px', fontFamily: 'var(--font-tech)' }}>Neural Network Workload Mapping</h3>
                    <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>Visualizing cryptographic proof verification workloads across validation nodes.</p>
                    <div className="chart-container">
                      <canvas className="neural-network-canvas" ref={canvasRef}></canvas>
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontFamily: 'var(--font-tech)', fontSize: '1.15rem', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Recent System Logs</h3>
                  <div className="activity-list">
                    <div className="activity-item">
                      <div className="activity-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <div className="activity-content">
                        <p style={{ fontWeight: '500', color: '#fff' }}>Proof block validation successful</p>
                        <span className="activity-time">Joined on {liveJoinDate}</span>
                      </div>
                    </div>
                    <div className="activity-item">
                      <div className="activity-icon" style={{ color: 'var(--purple)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                      </div>
                      <div className="activity-content">
                        <p style={{ fontWeight: '500', color: '#fff' }}>Synaptic level tracked: {liveXP} XP</p>
                        <span className="activity-time">Level {liveLevel} active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 3. BRAIN SCAN */}
        <section id="scan" className={`page-section ${activePage === 'scan' ? 'active show' : ''}`}>
          <div className="section-title-area">
            <h2>Cryptographic Brain Scan</h2>
            <p>Measure and convert cognitive traits into a unique neural proof signature. Must remain still during scanning sweeps.</p>
          </div>

          {!isConnected ? (
            <div className="glass-panel dashboard-locked" style={{ display: 'flex' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <h3>Authentication Required</h3>
              <p>Connect your Web3 cryptographic wallet to initialize scanning modules and write cognitive signatures.</p>
              <button className="btn btn-primary btn-glow" onClick={() => setWalletModalOpen(true)}>Connect Wallet</button>
            </div>
          ) : isWrongNetwork ? (
            <div className="glass-panel dashboard-locked" style={{ display: 'flex' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ef4444' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <h3>Ritual Network Required</h3>
              <p>Initialize scan requires switching your wallet to the Ritual Testnet.</p>
              <button onClick={switchChain} className="btn btn-primary btn-glow">Switch to Ritual Testnet</button>
            </div>
          ) : !hasProfile ? (
            renderProfileLockedView()
          ) : (
            <div className="scan-container">
              <div className="glass-panel scan-visual-wrapper" style={{ padding: '30px', width: '100%' }}>
                <div className={`scanner-box ${scanState.inProgress ? 'scanning' : ''}`} id="scanner-visual">
                  <div className="scanner-radar">
                    <div className="scanner-beam"></div>
                    <svg className="scanner-grid-brain" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M50 15C30 15 20 30 20 50C20 70 30 85 50 85C70 85 80 70 80 50C80 30 70 15 50 15Z" stroke="var(--purple)" strokeWidth="1.5" strokeDasharray="2 2" />
                      <path d="M50 15C45 25 45 75 50 85" stroke="var(--blue)" strokeWidth="1" />
                      <path d="M20 50C35 48 65 48 80 50" stroke="var(--blue)" strokeWidth="1" />
                      <circle cx="50" cy="50" r="8" stroke="var(--purple)" strokeWidth="1" fill="rgba(139,92,246,0.1)" />
                      <circle cx="35" cy="35" r="4" fill="var(--blue)" />
                      <circle cx="65" cy="35" r="4" fill="var(--blue)" />
                      <circle cx="30" cy="55" r="4" fill="var(--pink)" />
                      <circle cx="70" cy="55" r="4" fill="var(--pink)" />
                      <line x1="35" y1="35" x2="50" y2="50" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                      <line x1="65" y1="35" x2="50" y2="50" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                      <line x1="30" y1="55" x2="50" y2="50" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                      <line x1="70" y1="55" x2="50" y2="50" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                    </svg>
                    <div className="scanner-crosshair"></div>
                  </div>
                </div>
                <button className="btn btn-primary btn-glow" onClick={handleStartScan} disabled={scanState.inProgress} style={{ width: '100%' }}>
                  {scanState.inProgress ? 'Mapping Neural Cortex...' : 'Initialize Cognitive Mapping'}
                </button>
              </div>

              <div className="scan-console">
                <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontFamily: 'var(--font-tech)', marginBottom: '12px' }}>Extraction Feed</h3>
                  <div className="console-output">
                    {scanLogs.map((log, i) => (
                      <span key={i} className={log.type}>
                        [{log.time}] {log.message}
                      </span>
                    ))}
                    <div ref={consoleBottomRef}></div>
                  </div>
                </div>

                <div className={`glass-panel scan-results ${scanState.completed ? 'active' : ''}`} style={{ padding: '24px' }}>
                  <h3 style={{ fontFamily: 'var(--font-tech)', marginBottom: '8px' }}>Cognitive Breakdown</h3>
                  <p style={{ fontSize: '0.8rem', marginBottom: '16px' }}>Traits calculated via biometric latency checks during mapping.</p>
                  
                  <div className="traits-grid">
                    <div className="trait-card">
                      <div className="trait-header">
                        <span className="trait-name">Analytical Speed</span>
                        <span className="trait-percentage">{scanState.traits.analytical}%</span>
                      </div>
                      <div className="trait-bar-bg">
                        <div className="trait-bar-fill" style={{ width: `${scanState.traits.analytical}%` }}></div>
                      </div>
                    </div>
                    <div className="trait-card">
                      <div className="trait-header">
                        <span className="trait-name">Creative Entropy</span>
                        <span className="trait-percentage">{scanState.traits.creative}%</span>
                      </div>
                      <div className="trait-bar-bg">
                        <div className="trait-bar-fill" style={{ width: `${scanState.traits.creative}%` }}></div>
                      </div>
                    </div>
                    <div className="trait-card">
                      <div className="trait-header">
                        <span className="trait-name">Cryptographic Focus</span>
                        <span className="trait-percentage">{scanState.traits.crypto}%</span>
                      </div>
                      <div className="trait-bar-bg">
                        <div className="trait-bar-fill" style={{ width: `${scanState.traits.crypto}%` }}></div>
                      </div>
                    </div>
                    <div className="trait-card">
                      <div className="trait-header">
                        <span className="trait-name">Empathetic Synthesis</span>
                        <span className="trait-percentage">{scanState.traits.empathy}%</span>
                      </div>
                      <div className="trait-bar-bg">
                        <div className="trait-bar-fill" style={{ width: `${scanState.traits.empathy}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="results-hash" style={{ wordBreak: 'break-all', fontSize: '0.72rem' }}>
                    MENTAL PROOF HASH: {scanState.mentalHash || 'N/A'}
                  </div>
                  
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-secondary" onClick={handleSaveScanToProfile} disabled={txState.loading} style={{ flex: 1, fontSize: '0.85rem' }}>Save to Profile</button>
                      <button className="btn btn-primary btn-glow" onClick={handleMintProofCard} disabled={txState.loading} style={{ flex: 1, fontSize: '0.85rem' }}>Mint Proof Card</button>
                    </div>
                    
                    {txState.loading ? (
                      <div style={{ textAlign: 'center', marginTop: '6px' }}>
                        <div className="connecting-spinner" style={{ margin: '0 auto 6px', width: '20px', height: '20px' }}></div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{txState.statusMessage}</span>
                      </div>
                    ) : (
                      <button className="btn btn-primary btn-glow" onClick={handleVerifyScan} style={{ fontSize: '0.85rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}>
                        Verify Scan On-chain
                      </button>
                    )}
                    
                    {txState.error && (
                      <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '6px', textAlign: 'center' }}>Error: {txState.errorMessage}</p>
                    )}

                    {/* On-chain Verification Metadata display */}
                    {verificationMetadata && (
                      <div className="glass-panel" style={{ marginTop: '14px', padding: '14px', fontSize: '0.78rem', textAlign: 'left', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(10,5,20,0.6)' }}>
                        <h4 style={{ fontFamily: 'var(--font-tech)', color: '#10b981', marginBottom: '8px', fontSize: '0.8rem' }}>✓ On-chain Verification Metadata</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)' }}>
                          <div>
                            <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>Tx Hash:</span>{' '}
                            <a href={`https://explorer.ritualfoundation.org/tx/${verificationMetadata.hash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline', wordBreak: 'break-all' }}>
                              {verificationMetadata.hash}
                            </a>
                          </div>
                          <div>
                            <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>Block Number:</span> <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{verificationMetadata.blockNumber}</span>
                          </div>
                          <div>
                            <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>Timestamp:</span> <span style={{ color: '#fff' }}>{verificationMetadata.timestamp}</span>
                          </div>
                          <div>
                            <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>Status:</span> <span style={{ color: '#10b981', fontWeight: 600 }}>SUCCESS</span>
                          </div>
                        </div>
                        {passBalance && passBalance > 0n && (
                          <button 
                            className="btn btn-primary btn-glow" 
                            onClick={handleOpenShareModal}
                            style={{ width: '100%', marginTop: '14px', fontSize: '0.85rem', background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)', border: 'none' }}
                          >
                            🚀 Share Achievement
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 4. AI MENTOR */}
        <section id="mentor" className={`page-section ${activePage === 'mentor' ? 'active show' : ''}`}>
          <div className="section-title-area">
            <h2>Cortex AI Mentorship</h2>
            <p>Consult with customized AI models optimized for code compilation, security assessment, and general engineering strategy.</p>
          </div>

          {!isConnected ? (
            <div className="glass-panel dashboard-locked" style={{ display: 'flex' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <h3>Authentication Required</h3>
              <p>Connect your Web3 cryptographic wallet to initialize conversations with neural mentor agents.</p>
              <button className="btn btn-primary btn-glow" onClick={() => setWalletModalOpen(true)}>Connect Wallet</button>
            </div>
          ) : isWrongNetwork ? (
            <div className="glass-panel dashboard-locked" style={{ display: 'flex' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ef4444' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <h3>Ritual Network Required</h3>
              <p>Conversing with AI Mentors requires switching to the Ritual Testnet.</p>
              <button onClick={switchChain} className="btn btn-primary btn-glow">Switch to Ritual Testnet</button>
            </div>
          ) : !hasProfile ? (
            renderProfileLockedView()
          ) : (
            <div className="mentor-container">
              <div className="mentor-list">
                <div className={`mentor-card ${activeMentor === 'synthesizer' ? 'active' : ''}`} onClick={() => setActiveMentor('synthesizer')}>
                  <div className="mentor-avatar-container">
                    <div className="mentor-avatar" style={{ background: 'radial-gradient(circle, var(--purple) 0%, #3b82f6 100%)' }}>SYN</div>
                    <div className="mentor-meta">
                      <span className="mentor-name">The Synthesizer</span>
                      <span className="mentor-role">Cross-Disciplinary Architect</span>
                    </div>
                  </div>
                  <p className="mentor-desc">Specializes in system architecture, micro-service design, and combining Web3 paradigms with dynamic ML pipelines.</p>
                </div>

                <div className={`mentor-card ${activeMentor === 'cryptographer' ? 'active' : ''}`} onClick={() => setActiveMentor('cryptographer')}>
                  <div className="mentor-avatar-container">
                    <div className="mentor-avatar" style={{ background: 'radial-gradient(circle, var(--pink) 0%, var(--purple) 100%)' }}>CRY</div>
                    <div className="mentor-meta">
                      <span className="mentor-name">The Cryptographer</span>
                      <span className="mentor-role">Security Auditor Agent</span>
                    </div>
                  </div>
                  <p className="mentor-desc">Strict security advisor focused on smart contract vulnerabilities, zero-knowledge proofs, and secure off-chain storage.</p>
                </div>

                <div className={`mentor-card ${activeMentor === 'notionist' ? 'active' : ''}`} onClick={() => setActiveMentor('notionist')}>
                  <div className="mentor-avatar-container">
                    <div className="mentor-avatar" style={{ background: 'radial-gradient(circle, var(--cyan) 0%, var(--blue) 100%)' }}>MIN</div>
                    <div className="mentor-meta">
                      <span className="mentor-name">The Syntactician</span>
                      <span className="mentor-role">Clean Code Optimizer</span>
                    </div>
                  </div>
                  <p className="mentor-desc">Like Linear or Vercel software architectures. Analyzes script density, runtime latency, clean abstractions, and user design variables.</p>
                </div>
              </div>

              <div className="chat-window">
                <div className="chat-header">
                  <div className="chat-active-mentor">
                    <span style={{ fontFamily: 'var(--font-tech)', fontWeight: 600, fontSize: '1.05rem' }}>
                      {mentorDialogs[activeMentor].name}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {mentorDialogs[activeMentor].role}
                    </span>
                  </div>
                  <div className="chat-status">
                    <span className="chat-status-dot"></span>
                    <span>online</span>
                  </div>
                </div>

                <div className="chat-messages">
                  {chatMessages[activeMentor].map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.sender}`}>
                      {msg.text}
                    </div>
                  ))}
                  <div className={`typing-indicator ${botTyping ? 'active' : ''}`}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div ref={chatBottomRef}></div>
                </div>

                <div className="chat-input-area">
                  <form className="chat-form" onSubmit={handleSendChatMessage}>
                    <input 
                      type="text" 
                      className="chat-input" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Query cortex network parameters, code optimizations..." 
                      autoComplete="off"
                    />
                    <button type="submit" className="chat-submit" disabled={botTyping}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 5. BUILDER PROFILE */}
        <section id="profile" className={`page-section ${activePage === 'profile' ? 'active show' : ''}`}>
          <div className="section-title-area">
            <h2>Builder Identity Matrix</h2>
            <p>Construct your developer credentials card on-chain. Syncs dynamically with your brain scan proofs.</p>
          </div>

          {!isConnected ? (
            <div className="glass-panel dashboard-locked" style={{ display: 'flex' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <h3>Authentication Required</h3>
              <p>Connect your Web3 cryptographic wallet to decrypt builder cards and write credentials parameters.</p>
              <button className="btn btn-primary btn-glow" onClick={() => setWalletModalOpen(true)}>Connect Wallet</button>
            </div>
          ) : isWrongNetwork ? (
            <div className="glass-panel dashboard-locked" style={{ display: 'flex' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ef4444' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <h3>Ritual Network Required</h3>
              <p>Builder profile editing requires the Ritual Testnet network.</p>
              <button onClick={switchChain} className="btn btn-primary btn-glow">Switch to Ritual Testnet</button>
            </div>
          ) : !hasProfile ? (
            renderProfileLockedView()
          ) : (
            <div className="profile-container">
              <div className="glass-panel profile-form-box" style={{ padding: '28px' }}>
                <h3 style={{ fontFamily: 'var(--font-tech)' }}>Holographic Card Configuration</h3>
                
                <div className="form-group">
                  <label>Identity Alias</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={profileForm.name} 
                    onChange={(e) => handleProfileFormChange('name', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Primary Specialization</label>
                  <select 
                    className="form-select" 
                    value={profileForm.role}
                    onChange={(e) => handleProfileFormChange('role', e.target.value)}
                  >
                    <option value="Cortex Integrator">Cortex Integrator</option>
                    <option value="Neural Architect">Neural Architect</option>
                    <option value="ZKP Cryptographer">ZKP Cryptographer</option>
                    <option value="Compute Node Operator">Compute Node Operator</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Synaptic Description</label>
                  <textarea 
                    className="form-textarea" 
                    value={profileForm.bio}
                    onChange={(e) => handleProfileFormChange('bio', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Primary Technical Skillsets</label>
                  <div className="skills-select-grid">
                    {Object.keys(profileForm.skills).map(skill => (
                      <label key={skill} className="skill-checkbox-label">
                        <input 
                          type="checkbox" 
                          checked={profileForm.skills[skill]} 
                          onChange={() => handleProfileSkillToggle(skill)}
                        /> {skill}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Profile Metadata URI</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={profileForm.metadataURI}
                    onChange={(e) => handleProfileFormChange('metadataURI', e.target.value)}
                    placeholder="https://api.ritualbrain.net/profiles/user.json"
                  />
                </div>

                <div className="form-group">
                  <label>X (Twitter) Username</label>
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem', pointerEvents: 'none' }}>@</span>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ paddingLeft: '28px' }}
                      value={profileForm.xUsername || ''}
                      onChange={(e) => handleProfileFormChange('xUsername', e.target.value)}
                      placeholder="username"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Profile Avatar</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {profileForm.avatar ? (
                        <img src={profileForm.avatar} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <input 
                        type="file" 
                        id="avatar-upload" 
                        accept="image/*" 
                        onChange={handleAvatarChange} 
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="avatar-upload" className="btn btn-secondary" style={{ display: 'inline-block', fontSize: '0.8rem', padding: '6px 12px', cursor: 'pointer', margin: 0, width: 'auto' }}>
                        Upload Image
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  {txState.loading ? (
                    <div style={{ textAlign: 'center' }}>
                      <div className="connecting-spinner" style={{ margin: '0 auto 8px', width: '24px', height: '24px' }}></div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{txState.statusMessage}</span>
                      {txState.hash && (
                        <p style={{ marginTop: '4px', fontSize: '0.75rem' }}>
                          Hash: <a href={`https://explorer.ritualfoundation.org/tx/${txState.hash}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'var(--blue)' }}>{txState.hash.slice(0, 10)}...{txState.hash.slice(-8)}</a>
                        </p>
                      )}
                    </div>
                  ) : (
                    <button className="btn btn-primary btn-glow" onClick={handleUpdateProfileSubmit} disabled={txState.loading} style={{ width: '100%' }}>
                      Save Credentials to Blockchain
                    </button>
                  )}
                  {txState.error && (
                    <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '6px', textAlign: 'center' }}>Error: {txState.errorMessage}</p>
                  )}
                </div>
              </div>

              <div className="profile-card-wrapper">
                <div className="cyber-card" ref={cardRef}>
                  <div className="cyber-card-header">
                    <div className="card-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img src="/logo.png" alt="Ritual Identity Logo" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                      <span>Ritual Identity</span>
                    </div>
                    <div className="card-chip"></div>
                  </div>

                  <div className="cyber-card-body">
                    <div className="card-avatar">
                      {profileForm.avatar ? (
                        <img src={profileForm.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                      ) : (
                        profileInitials || '??'
                      )}
                    </div>
                    <div>
                      <h3 className="card-name">{profileForm.name || 'Anonymous Developer'}</h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="card-role">{profileForm.role}</span>
                        {profileForm.xUsername && (
                          <span style={{ fontSize: '0.75rem', color: '#c084fc', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.2)' }}>
                            @{profileForm.xUsername}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="card-bio">{profileForm.bio || 'No bio descriptions synced yet.'}</p>
                    
                    <div className="card-skills">
                      {Object.keys(profileForm.skills).filter(s => profileForm.skills[s]).map(s => (
                        <span key={s} className="card-skill-badge">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="cyber-card-footer">
                    <div className="card-stats-preview">
                      <div className="card-stat">
                        <span className="card-stat-label">Level / XP</span>
                        <span className="cyber-accent" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          Lvl {liveLevel} ({liveXP} XP)
                        </span>
                      </div>
                      <div className="card-stat">
                        <span className="card-stat-label">Sync Quotient</span>
                        <span className="card-stat-val">
                          {liveBrainScore > 0 ? `${liveBrainScore}%` : 'Baseline'}
                        </span>
                      </div>
                    </div>
                    <div className="card-hash" title={`Pass NFT ID: ${livePassId ? livePassId.toString() : 'None'}`}>
                      {livePassId ? `Pass #${livePassId.toString()}` : shortAddress}
                    </div>
                  </div>
                </div>

                {/* Milestone Badges UI Overlay */}
                <div className="glass-panel" style={{ marginTop: '24px', padding: '20px', width: '320px' }}>
                  <h4 style={{ fontFamily: 'var(--font-tech)', fontSize: '0.9rem', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>Ecosystem Milestone Badges</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: liveBadge1 > 0n ? 1 : 0.25 }}>
                      <span style={{ fontSize: '1.2rem' }}>🔰</span>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>Synapse Initiate</p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Milestone: Reach 1,000 XP</p>
                      </div>
                      {liveBadge1 > 0n && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>x{liveBadge1.toString()}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: liveBadge2 > 0n ? 1 : 0.25 }}>
                      <span style={{ fontSize: '1.2rem' }}>⚡</span>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>Cortex Builder</p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Milestone: Reach 5,000 XP</p>
                      </div>
                      {liveBadge2 > 0n && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>x{liveBadge2.toString()}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: liveBadge3 > 0n ? 1 : 0.25 }}>
                      <span style={{ fontSize: '1.2rem' }}>👑</span>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>Neural Overlord</p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Milestone: Reach 10,000 XP</p>
                      </div>
                      {liveBadge3 > 0n && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>x{liveBadge3.toString()}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 6. LEADERBOARD */}
        <section id="leaderboard" className={`page-section ${activePage === 'leaderboard' ? 'active show' : ''}`}>
          <div className="section-title-area">
            <h2>Global Leaderboard of Minds</h2>
            <p>Explore the ranking index of builder nodes based on active computing power contributed, trait density, and verification rating.</p>
          </div>

          <div className="leaderboard-controls">
            <div className="search-box-wrapper">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search builder, specialization or hashes..."
                value={leaderboardSearch}
                onChange={(e) => setLeaderboardSearch(e.target.value)}
              />
            </div>
            
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Sorted by <span style={{ color: 'var(--purple)', fontWeight: 600 }}>Active GFLOPS</span>
            </div>
          </div>

          <div className="table-wrapper glass-panel">
            {leaderboardLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div className="connecting-spinner" style={{ width: '16px', height: '16px' }}></div>
                <span>Syncing builder nodes from Ritual chain...</span>
              </div>
            )}
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortLeaderboard('rank')}>Rank</th>
                  <th onClick={() => handleSortLeaderboard('name')}>Builder Node</th>
                  <th onClick={() => handleSortLeaderboard('role')}>Specialization</th>
                  <th onClick={() => handleSortLeaderboard('sync')}>Neural Sync</th>
                  <th onClick={() => handleSortLeaderboard('gflops')} style={{ textAlign: 'right' }}>Compute (GFLOPS)</th>
                  <th style={{ textAlign: 'right' }}>Proof Signature</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.map((row, idx) => {
                  const init = row.name
                    .split(' ')
                    .slice(0, 2)
                    .map(w => w[0] ? w[0].toUpperCase() : '')
                    .join('');

                  let badgeClass = 'rank-badge rank-other';
                  if (row.rank === 1) badgeClass = 'rank-badge rank-1';
                  else if (row.rank === 2) badgeClass = 'rank-badge rank-2';
                  else if (row.rank === 3) badgeClass = 'rank-badge rank-3';

                  return (
                    <tr key={idx} style={row.isUser ? { background: 'rgba(139, 92, 246, 0.08)', outline: '1px solid rgba(139,92,246,0.2)' } : undefined}>
                      <td><span className={badgeClass}>{row.rank}</span></td>
                      <td>
                        <div className="leaderboard-builder-cell">
                          <div className="leaderboard-avatar">{init}</div>
                          <span style={{ fontWeight: 600, color: row.isUser ? '#c084fc' : '#fff' }}>{row.name}</span>
                          {row.isUser && <span style={{ fontSize: '0.65rem', color: '#a78bfa', marginLeft: '6px', opacity: 0.8 }}>YOU</span>}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.role}</td>
                      <td style={{ color: '#c084fc', fontWeight: 500 }}>{row.sync}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fff' }}>{row.gflops}</td>
                      <td style={{ textAlign: 'right' }} className="leaderboard-hash">{row.hash}</td>
                    </tr>
                  );
                })}
                {filteredLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>
                      No verified builder nodes matching search parameters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* Connect Wallet Modal */}
      <div className={`modal-overlay ${walletModalOpen ? 'active' : ''}`}>
        <div className="modal-box">
          <button className="modal-close" onClick={() => setWalletModalOpen(false)}>&times;</button>
          
          {!isConnecting ? (
            <div id="modal-wallet-selection">
              <h3 className="modal-title">Establish Synaptic Link</h3>
              <p className="modal-subtitle">Select a cryptographic wallet to link your builder identity and nodes.</p>
              
              <div className="wallet-options">
                <div className="wallet-option" onClick={() => handleConnectWallet('metamask')}>
                  <div className="wallet-option-left">
                    <div className="wallet-option-logo">
                      {/* MetaMask official fox SVG — accurate brand logo */}
                      <svg viewBox="0 0 318.6 318.6" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="274.1,35.5 174.6,109.4 193.6,65" style={{fill:'#e2761b',stroke:'#e2761b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="44.4,35.5 143.1,110.1 125.1,65" style={{fill:'#e4761b',stroke:'#e4761b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="238.3,206.8 211.8,247.4 268.5,263 284.8,207.7" style={{fill:'#e4761b',stroke:'#e4761b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="33.9,207.7 50.1,263 106.8,247.4 80.3,206.8" style={{fill:'#e4761b',stroke:'#e4761b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="103.6,138.2 87.8,162.1 144.1,164.6 142.1,104.1" style={{fill:'#e4761b',stroke:'#e4761b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="214.9,138.2 175.9,103.4 174.6,164.6 230.8,162.1" style={{fill:'#e4761b',stroke:'#e4761b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="106.8,247.4 140.6,230.9 111.4,208.1" style={{fill:'#e4761b',stroke:'#e4761b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="177.9,230.9 211.8,247.4 207.1,208.1" style={{fill:'#e4761b',stroke:'#e4761b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="211.8,247.4 177.9,230.9 180.6,253 180.3,262.3" style={{fill:'#d7c1b3',stroke:'#d7c1b3',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="106.8,247.4 138.3,262.3 138.1,253 140.6,230.9" style={{fill:'#d7c1b3',stroke:'#d7c1b3',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="138.8,193.5 110.6,185.2 130.5,176.1" style={{fill:'#233447',stroke:'#233447',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="179.7,193.5 188,176.1 207.9,185.2" style={{fill:'#233447',stroke:'#233447',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="106.8,247.4 111.6,206.8 80.3,207.7" style={{fill:'#cd6116',stroke:'#cd6116',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="207,206.8 211.8,247.4 238.3,207.7" style={{fill:'#cd6116',stroke:'#cd6116',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="230.8,162.1 174.6,164.6 179.8,193.5 188.1,176.1 208,185.2" style={{fill:'#cd6116',stroke:'#cd6116',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="110.6,185.2 130.5,176.1 138.8,193.5 144.1,164.6 87.8,162.1" style={{fill:'#cd6116',stroke:'#cd6116',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="87.8,162.1 111.4,208.1 110.6,185.2" style={{fill:'#e4751f',stroke:'#e4751f',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="208,185.2 207.1,208.1 230.8,162.1" style={{fill:'#e4751f',stroke:'#e4751f',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="144.1,164.6 138.8,193.5 145.4,227.6 146.9,182.7" style={{fill:'#e4751f',stroke:'#e4751f',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="174.6,164.6 171.9,182.6 179.8,193.5" style={{fill:'#e4751f',stroke:'#e4751f',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="145.4,227.6 138.8,193.5 110.6,185.2 111.4,208.1" style={{fill:'#f6851b',stroke:'#f6851b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="207.1,208.1 208,185.2 179.8,193.5 174.6,164.6 171.9,182.6 179.8,193.5" style={{fill:'#f6851b',stroke:'#f6851b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="180.3,262.3 180.6,253 178.1,250.8 140.4,250.8 138.1,253 138.3,262.3 106.8,247.4 117.8,256.4 140.1,271.9 178.4,271.9 200.8,256.4 211.8,247.4" style={{fill:'#c0ad9e',stroke:'#c0ad9e',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="177.9,230.9 174.9,228.6 143.6,228.6 140.6,230.9 138.1,253 140.4,250.8 178.1,250.8" style={{fill:'#161616',stroke:'#161616',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="278.3,114.2 286.8,73.4 274.1,35.5 177.9,106.9 214.9,138.2 267.2,153.5 278.8,140 273.8,136.4 281.8,129.1 275.6,124.3 283.6,118.2" style={{fill:'#763d16',stroke:'#763d16',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="31.8,73.4 40.3,114.2 34.9,118.2 42.9,124.3 36.8,129.1 44.8,136.4 39.8,140 51.3,153.5 103.6,138.2 140.6,106.9 44.4,35.5" style={{fill:'#763d16',stroke:'#763d16',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="267.2,153.5 214.9,138.2 230.8,162.1 207.1,208.1 238.3,207.7 284.8,207.7" style={{fill:'#f6851b',stroke:'#f6851b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="103.6,138.2 51.3,153.5 33.9,207.7 80.3,207.7 111.4,208.1 87.8,162.1" style={{fill:'#f6851b',stroke:'#f6851b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                        <polygon points="174.6,164.6 177.9,106.9 193.6,65 125.1,65 140.6,106.9 144.1,164.6 145.3,182.8 145.4,227.6 173.1,227.6 173.3,182.8" style={{fill:'#f6851b',stroke:'#f6851b',strokeLinecap:'round',strokeLinejoin:'round'}} />
                      </svg>
                    </div>
                    <span className="wallet-option-name">MetaMask</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Browser Ext</span>
                </div>

                <div className="wallet-option" onClick={() => handleConnectWallet('coinbase')}>
                  <div className="wallet-option-left">
                    <div className="wallet-option-logo">
                      {/* Coinbase Wallet official logo — blue circle, white C cutout */}
                      <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                        <rect width="1024" height="1024" rx="220" fill="#0052FF"/>
                        <path d="M512 170C323.4 170 170 323.4 170 512C170 700.6 323.4 854 512 854C700.6 854 854 700.6 854 512C854 323.4 700.6 170 512 170ZM664 564H596C578.3 564 564 578.3 564 596V664C564 681.7 549.7 696 532 696H492C474.3 696 460 681.7 460 664V596C460 578.3 445.7 564 428 564H360C342.3 564 328 549.7 328 532V492C328 474.3 342.3 460 360 460H428C445.7 460 460 445.7 460 428V360C460 342.3 474.3 328 492 328H532C549.7 328 564 342.3 564 360V428C564 445.7 578.3 460 596 460H664C681.7 460 696 474.3 696 492V532C696 549.7 681.7 564 664 564Z" fill="white"/>
                      </svg>
                    </div>
                    <span className="wallet-option-name">Coinbase Wallet</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Coinbase</span>
                </div>

              </div>
            </div>
          ) : (
            <div className="wallet-connecting-flow active">
              <div className="connecting-spinner"></div>
              <h3 className="modal-title">Negotiating Synaptic Link...</h3>
              <p className="modal-subtitle" style={{ marginBottom: 0 }}>Authorizing connection with node protocol wrapper. Please accept in your wallet pop-up.</p>
            </div>
          )}
        </div>
      </div>

      {/* Offscreen achievement card node used for html-to-image export */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', zIndex: -1000 }}>
        <div id="achievement-card-ref" style={{
          width: '1200px',
          height: '675px',
          background: 'linear-gradient(135deg, #07040e 0%, #170d30 50%, #0d061c 100%)',
          fontFamily: 'Inter, sans-serif',
          color: '#fff',
          padding: '48px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Cyber Grid background overlay */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.04) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
            pointerEvents: 'none',
          }}></div>

          {/* Glowing radial circles */}
          <div style={{
            position: 'absolute',
            top: '-150px',
            right: '-150px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.22) 0%, transparent 70%)',
            filter: 'blur(30px)',
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '-150px',
            left: '-150px',
            width: '450px',
            height: '450px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, transparent 70%)',
            filter: 'blur(35px)',
          }}></div>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                boxSizing: 'border-box'
              }}>
                <img src="/logo.png" alt="Ritual Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '2px', color: '#c084fc', textShadow: '0 0 10px rgba(192, 132, 252, 0.3)' }}>
                RITUAL CORTEX
              </span>
            </div>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              fontSize: '0.9rem',
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: '20px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              textShadow: '0 0 8px rgba(16, 185, 129, 0.3)',
            }}>
              Ritual Testnet Verified
            </div>
          </div>

          {/* Body Content */}
          <div style={{ display: 'flex', gap: '48px', alignItems: 'center', zIndex: 2, flex: 1, marginTop: '24px' }}>
            {/* Left Column: Avatar & Identity Card */}
            <div style={{
              width: '420px',
              background: 'rgba(255, 255, 255, 0.02)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '20px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                top: '-1px', left: '20px', right: '20px',
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.5), transparent)',
              }}></div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  border: '2.5px solid #8b5cf6',
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
                  flexShrink: 0,
                }}>
                  {profileForm.avatar ? (
                    <img src={profileForm.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#a78bfa' }}>
                      {profileInitials || '??'}
                    </div>
                  )}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: '#fff' }}>
                    {profileForm.name || 'Anonymous Developer'}
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)' }}>{profileForm.role}</span>
                    {profileForm.xUsername && (
                      <span style={{ fontSize: '0.9rem', color: '#c084fc', fontWeight: 600 }}>@{profileForm.xUsername}</span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', lineHeight: '1.4', height: '60px', overflow: 'hidden' }}>
                "{profileForm.bio || 'No bio descriptions synced yet.'}"
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                <span>WALLET</span>
                <span>{address ? `${address.slice(0, 8)}...${address.slice(-6)}` : ''}</span>
              </div>
            </div>

            {/* Right Column: Stats achievements */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Brain Score</span>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#c084fc', textShadow: '0 0 15px rgba(192, 132, 252, 0.4)' }}>
                    {liveBrainScore}%
                  </span>
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Compute Power</span>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>
                    {((liveBrainScore * 1000) + (liveLevel * 5000) + (liveXP * 10)).toLocaleString()} <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)' }}>GFLOPS</span>
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Synaptic Level</span>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>
                    Level {liveLevel} <span style={{ fontSize: '1rem', color: '#a78bfa' }}>({liveXP} XP)</span>
                  </span>
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Brain Pass</span>
                  <span style={{
                    background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    padding: '6px 16px',
                    borderRadius: '6px',
                    boxShadow: '0 0 15px rgba(124, 58, 237, 0.4)',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    marginTop: '4px',
                  }}>
                    {livePassId ? `PASS #${livePassId.toString()}` : 'ACTIVE'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer decoration */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            zIndex: 2,
          }}>
            <span>CRITICAL PROTOCOL: LEVEL {liveLevel} VALIDATOR NODE ACTIVE</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>SECURE VERIFICATION SHIELD v2.0.1</span>
          </div>
        </div>
      </div>

      {/* Share Achievement Modal */}
      <div className={`modal-overlay ${shareModalOpen ? 'active' : ''}`} style={{ zIndex: 210 }}>
        <div className="modal-box" style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <button className="modal-close" onClick={() => setShareModalOpen(false)}>&times;</button>
          
          <h3 className="modal-title" style={{ marginBottom: '4px' }}>Share Achievement</h3>
          <p className="modal-subtitle" style={{ marginBottom: '10px' }}>Broadcast your cryptographic validator credentials on social networks.</p>

          {shareCardLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', gap: '16px' }}>
              <div className="connecting-spinner" style={{ width: '40px', height: '40px' }}></div>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {shareCardProgress}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              {shareCardUrl ? (
                <div style={{
                  width: '100%',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  background: '#090514',
                  lineHeight: 0
                }}>
                  <img src={shareCardUrl} alt="Achievement Card Preview" style={{ width: '100%', height: 'auto', display: 'block' }} />
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Generating card preview...</div>
              )}

              <div style={{ display: 'flex', width: '100%', gap: '12px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleDownloadCard}
                  disabled={!shareCardUrl}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Card
                </button>
                <button
                  className="btn btn-primary btn-glow"
                  onClick={handleShareOnX}
                  disabled={!shareCardUrl}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Share on X
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Section */}
      <footer>
        <div className="container footer-wrapper">
          <div className="footer-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/logo.png" alt="Ritual Brain Logo" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            <span>Ritual Brain © 2026</span>
            <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
            <span style={{ 
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              textShadow: '0 0 8px rgba(139, 92, 246, 0.4)',
              background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Made with <span style={{ color: '#ef4444', WebkitTextFillColor: 'initial', fontSize: '0.9rem' }}>❤️</span> by Ayush
            </span>
          </div>

          <ul className="footer-links">
            <li><a href="https://ritual.net" target="_blank" rel="noreferrer">Ritual Network</a></li>
            <li><a href="https://github.com/ritual-net" target="_blank" rel="noreferrer">Source Code</a></li>
            <li><a href="#">Security Protocol</a></li>
            <li><a href="#">Consensus Nodes</a></li>
          </ul>
        </div>
      </footer>
    </>
  );
}
