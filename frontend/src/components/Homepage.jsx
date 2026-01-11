import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue, useMotionTemplate } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import {
    Code2, Terminal, Cpu, Cloud, Zap, Shield, Github, ArrowRight,
    CheckCircle2, Box, Layers, Sparkles, Command, Palette, Share2,
    Globe, Laptop, Lock, Database
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// --- Shared Components ---

const cn = (...classes) => classes.filter(Boolean).join(' ');

const Section = ({ children, className = "" }) => (
    <section className={cn("min-h-screen relative flex flex-col justify-center overflow-hidden", className)}>
        {children}
    </section>
);

const Button = ({ children, variant = "primary", className = "", icon: Icon, onClick }) => {
    const baseClass = "px-8 py-4 rounded-full font-medium text-sm transition-all duration-300 flex items-center gap-2 group relative overflow-hidden cursor-pointer";
    const variants = {
        primary: "bg-white text-black hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]",
        secondary: "bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/40",
        glow: "bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] border border-transparent"
    };

    return (
        <button onClick={onClick} className={cn(baseClass, variants[variant], className)}>
            <span className="relative z-10 flex items-center gap-2">
                {children}
                {Icon && <Icon className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
            </span>
            {variant === 'primary' && (
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            )}
        </button>
    );
};

const GradientText = ({ children, className = "" }) => (
    <span className={cn("bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40", className)}>
        {children}
    </span>
);

// --- Advanced Components ---

const TypewriterCode = () => {
    const [text, setText] = useState('');
    const codeString = `import { OpenSource } from 'community';

function buildFuture() {
  const stack = [
    'React', 'Vite', 
    'Tailwind', 'AI'
  ];

  return stack.map(tech => 
    new Innovation(tech)
  );
}`;

    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            setText(codeString.slice(0, i));
            i++;
            if (i > codeString.length) {
                clearInterval(interval);
            }
        }, 50);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="font-mono text-xs md:text-sm leading-relaxed relative">
            <pre className="text-gray-300">
                <span dangerouslySetInnerHTML={{
                    __html: text.replace(/import|from|function|const|new|return/g, '<span class="text-purple-400">$&</span>')
                        .replace(/'[^']*'/g, '<span class="text-green-400">$&</span>')
                        .replace(/OpenSource|Innovation/g, '<span class="text-yellow-400">$&</span>')
                        .replace(/stack/g, '<span class="text-blue-400">$&</span>')
                        .replace(/\n/g, '<br/>')
                }} />
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse align-middle ml-1" />
            </pre>
        </div>
    );
};

const InfiniteMarquee = () => {
    const technologies = ["React", "TypeScript", "Python", "Rust", "Go", "Docker", "Kubernetes", "PostgreSQL", "GraphQL"];
    return (
        <div className="w-full py-10 border-y border-white/5 bg-black/50 backdrop-blur-sm overflow-hidden flex relative z-10">
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent z-20" />
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent z-20" />

            <motion.div
                className="flex gap-20 whitespace-nowrap"
                animate={{ x: [0, -1000] }}
                transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
            >
                {[...technologies, ...technologies, ...technologies].map((tech, i) => (
                    <span key={i} className="text-xl font-bold text-white/20 uppercase tracking-widest hover:text-white/60 transition-colors cursor-default select-none">
                        {tech}
                    </span>
                ))}
            </motion.div>
        </div>
    );
};

const BentoCard = ({ title, desc, icon: Icon, className, children, delay }) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }) {
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            onMouseMove={handleMouseMove}
            className={cn(
                "group relative rounded-3xl bg-neutral-900/50 border border-white/10 p-6 overflow-hidden hover:border-white/20 transition-colors",
                className
            )}
        >
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
                style={{
                    background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(255, 255, 255, 0.1),
              transparent 80%
            )
          `,
                }}
            />

            <div className="relative z-10 h-full flex flex-col">
                <div className="mb-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                    <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
                <p className="text-white/50 text-sm mb-6">{desc}</p>
                <div className="mt-auto">
                    {children}
                </div>
            </div>
        </motion.div>
    );
};

const FeaturesBento = () => (
    <section id="features" className="py-32 container mx-auto px-4">
        <div className="mb-20 text-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs mb-6"
            >
                <Sparkles className="w-3 h-3" />
                <span>Open Source Power</span>
            </motion.div>
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Built for <GradientText>developers.</GradientText>
            </h2>
            <p className="text-xl text-white/50 max-w-2xl mx-auto">
                Free, open-source, and community driven.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[400px]">
            {/* Large Card - Editor */}
            <BentoCard
                title="Monaco Engine"
                desc="Powered by the industry standard editor. Setup in seconds, not hours."
                icon={Code2}
                className="md:col-span-2"
                delay={0.1}
            >
                <div className="h-full w-full rounded-xl bg-[#1e1e1e] border border-white/10 p-4 shadow-2xl relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-500">
                    <div className="flex gap-1.5 mb-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                    </div>
                    <div className="space-y-2 opacity-80">
                        <div className="h-2 w-1/3 bg-blue-900/50 rounded animate-pulse" />
                        <div className="pl-4 h-2 w-1/2 bg-white/10 rounded" />
                        <div className="pl-4 h-2 w-2/3 bg-white/10 rounded" />
                        <div className="pl-8 h-2 w-1/4 bg-purple-900/50 rounded" />
                        <div className="h-2 w-1/3 bg-white/10 rounded delay-75" />
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/20 blur-[80px]" />
                </div>
            </BentoCard>

            {/* Tall Card - AI */}
            <BentoCard
                title="AI Copilot"
                desc="Local LLM support. Your code stays on your machine."
                icon={Cpu}
                className="md:row-span-2"
                delay={0.2}
            >
                <div className="h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent" />
                    <div className="text-center space-y-4 relative z-10 w-full">
                        {[1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ x: -20, opacity: 0 }}
                                whileInView={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.2 + (i * 0.1) }}
                                className="bg-white/5 border border-white/10 p-3 rounded-xl backdrop-blur-md mx-4 text-xs text-left"
                            >
                                <div className="flex gap-2">
                                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                                    <div className="h-2 w-20 bg-white/20 rounded mt-1" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </BentoCard>

            {/* Small Card - Cloud */}
            <BentoCard
                title="Docker Ready"
                desc="Containerized environments by default."
                icon={Box}
                delay={0.3}
            >
                <div className="mt-4 flex items-center gap-2 text-blue-400 text-sm font-mono bg-blue-400/10 px-3 py-1 rounded-full w-fit">
                    <CheckCircle2 className="w-3 h-3" /> Container Ready
                </div>
            </BentoCard>

            {/* Small Card - Terminal */}
            <BentoCard
                title="Full Terminal"
                desc="zsh, fish, bash - zero configuration."
                icon={Terminal}
                delay={0.4}
            >
                <div className="mt-4 font-mono text-xs text-white/60 bg-black p-3 rounded-lg border border-white/10">
                    <span className="text-green-400">➜</span> <span className="text-blue-400">~</span> git push origin main
                </div>
            </BentoCard>
        </div>
    </section>
);

// --- Main Sections ---

const Navbar = ({ onLogin }) => {
    const { scrollY } = useScroll();
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        return scrollY.onChange((latest) => {
            setIsScrolled(latest > 20);
        });
    }, [scrollY]);

    return (
        <motion.nav
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                isScrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/5 py-4' : 'py-6 bg-transparent'
            )}
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8 }}
        >
            <div className="container mx-auto px-6 flex justify-between items-center">
                <div className="flex items-center gap-2 font-mono font-bold text-xl tracking-tighter cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                        <Terminal className="w-5 h-5" />
                    </div>
                    AI-IDE
                </div>

                <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
                    {['Features', 'Docs', 'Community'].map((item) => (
                        <a key={item} href={`#${item.toLowerCase()}`} className="hover:text-white transition-colors relative group">
                            {item}
                            <span className="absolute -bottom-1 left-0 w-0 h-px bg-white transition-all group-hover:w-full" />
                        </a>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={onLogin}
                        className="text-sm text-white/80 hover:text-white transition-colors px-4 py-2"
                    >
                        Log In
                    </button>
                    <Button variant="primary" className="!py-2 !px-4 !text-xs" onClick={onLogin}>
                        Get Started
                    </Button>
                </div>
            </div>
        </motion.nav>
    );
};

const Hero = ({ onLogin }) => {
    const { scrollY } = useScroll();
    const y1 = useTransform(scrollY, [0, 500], [0, 200]);
    const opacity = useTransform(scrollY, [0, 300], [1, 0]);

    // 3D Tilt Effect State
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useTransform(y, [-100, 100], [10, -10]);
    const rotateY = useTransform(x, [-100, 100], [-10, 10]);

    return (
        <div className="relative pt-32 pb-20 overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                <div className="absolute top-0 left-0 right-0 h-[800px] bg-gradient-to-b from-blue-600/10 via-purple-600/5 to-transparent blur-3xl opacity-50" />
                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
            </div>

            <div className="container mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center gap-12">
                <motion.div
                    style={{ y: y1, opacity }}
                    className="flex-1 text-center md:text-left"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs mb-8 backdrop-blur-sm"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                        <span className="text-white/80">v2.0 Open Source Release</span>
                    </motion.div>

                    <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 leading-[0.9]">
                        <GradientText>Unleash your</GradientText><br />
                        creativity.
                    </h1>

                    <p className="max-w-xl text-lg text-white/60 mb-10 leading-relaxed mx-auto md:mx-0">
                        The next-gen open source IDE.
                        Built by developers, for developers.
                        Free forever.
                    </p>

                    <div className="flex flex-col md:flex-row items-center gap-4 justify-center md:justify-start">
                        <Button variant="glow" icon={ArrowRight} onClick={onLogin}>
                            Start Coding Now
                        </Button>
                        <Button variant="secondary" icon={Github} onClick={() => window.open('https://github.com/VedantPanchal23/Web-IDE', '_blank')}>
                            Star on GitHub
                        </Button>
                    </div>
                </motion.div>

                {/* Floating Code Window with 3D Tilt */}
                <div
                    className="flex-1 w-full max-w-lg relative perspective-1000"
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        x.set(e.clientX - rect.left - rect.width / 2);
                        y.set(e.clientY - rect.top - rect.height / 2);
                    }}
                    onMouseLeave={() => {
                        x.set(0);
                        y.set(0);
                    }}
                >
                    <motion.div
                        style={{ rotateX, rotateY }}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-xl opacity-30 animate-pulse" />
                        <div className="relative rounded-xl bg-[#0f0f0f] border border-white/10 shadow-2xl overflow-hidden transition-transform duration-200">
                            <div className="flex items-center px-4 py-3 border-b border-white/5 bg-white/5">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                                </div>
                                <div className="ml-4 text-xs text-white/40 font-mono">future.tsx</div>
                            </div>
                            <div className="p-6 h-[200px] md:h-[280px]">
                                <TypewriterCode />
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

const Footer = () => (
    <footer className="py-12 border-t border-white/5 bg-black">
        <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-2 text-white/60">
                    <Terminal className="w-5 h-5" />
                    <span className="font-mono font-bold">AI-IDE</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50 ml-2">Open Source</span>
                </div>
                <div className="flex gap-8 text-sm text-white/40">
                    <a href="https://github.com/VedantPanchal23/Web-IDE" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
                    <a href="#" className="hover:text-white transition-colors">Discord</a>
                    <a href="#" className="hover:text-white transition-colors">Docs</a>
                    <a href="#" className="hover:text-white transition-colors">License</a>
                </div>
                <div className="text-sm text-white/40">
                    Built with ❤️ by the community.
                </div>
            </div>
        </div>
    </footer>
);

// --- Main Page Component ---

const Homepage = () => {
    const { login } = useAuth();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleLogin = async () => {
        try {
            await login();
        } catch (error) {
            console.error("Login failed", error);
        }
    };

    if (!isMounted) return null;

    return (
        <ReactLenis root>
            <div className="bg-black text-white min-h-screen selection:bg-purple-500/30 selection:text-white">
                <Navbar onLogin={handleLogin} />

                <main>
                    <Hero onLogin={handleLogin} />
                    <InfiniteMarquee />
                    <FeaturesBento />

                    <Section className="py-32">
                        <div className="container mx-auto px-4">
                            <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-b from-blue-900/20 to-purple-900/20 border border-white/10 px-6 py-24 text-center">
                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                                <div className="relative z-10 max-w-2xl mx-auto space-y-8">
                                    <h2 className="text-5xl md:text-7xl font-bold tracking-tight">
                                        Join the <br />
                                        <GradientText>Open Source Revolution.</GradientText>
                                    </h2>
                                    <p className="text-xl text-white/60">
                                        Contribute, fork, or just build something amazing.
                                    </p>
                                    <div className="flex justify-center pt-8">
                                        <Button variant="primary" icon={ArrowRight} onClick={handleLogin} className="!text-lg !px-12 !py-6">
                                            Start Building
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Section>
                </main>

                <Footer />
            </div>
        </ReactLenis>
    );
};

export default Homepage;
