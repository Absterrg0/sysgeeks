import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, faqPage, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/design-whatsapp";
const TITLE = "Design WhatsApp: System Design Interview Walkthrough";
const DESCRIPTION =
  "Work through a WhatsApp-style chat system design interview: persistent connections, encrypted delivery, offline queues, multi-device fan-out, capacity estimates, and failure cases.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const FAQ = [
  {
    question: "How do you design WhatsApp in a system design interview?",
    answer:
      "Separate connection management from durable message state. Route each sender's encrypted message through a connection gateway to a recipient's devices, acknowledge a durable enqueue, and deliver over a persistent connection when a device is online. Keep a bounded per-device offline queue, deduplicate retries by message ID, and use push notifications only to wake offline clients.",
  },
  {
    question: "Does this walkthrough describe WhatsApp's actual architecture?",
    answer:
      "No. It is an original interview design with explicit assumptions. The linked Meta Engineering articles document specific WhatsApp systems and security choices; they do not reveal every internal service or the complete production architecture.",
  },
  {
    question: "How should a chat system handle offline users?",
    answer:
      "Persist encrypted messages in a bounded queue keyed by recipient device. Retry delivery after reconnect, remove a queued item only after the chosen delivery acknowledgement, and expire or reject messages according to a stated retention policy. A push notification is a wake-up hint, not the message source of truth.",
  },
  {
    question: "How does multi-device delivery affect message encryption?",
    answer:
      "A sender may need to encrypt a message separately for each recipient device, which increases work and bytes with the number of devices. Maintain a current device list, handle devices added or revoked during delivery, and keep private keys on clients. Meta has publicly described this client-fanout approach for WhatsApp multi-device messaging.",
  },
];

export default function DesignWhatsAppPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview guide", path: "/system-design-interview" },
                { name: "Design WhatsApp", path: PATH },
              ]),
              {
                "@type": "Article",
                headline: TITLE,
                description: DESCRIPTION,
                url: `${SITE_URL}${PATH}`,
                mainEntityOfPage: `${SITE_URL}${PATH}`,
                datePublished: "2026-10-13",
                dateModified: "2026-10-13",
                inLanguage: "en",
                author: { "@id": `${SITE_URL}/#organization` },
                publisher: { "@id": `${SITE_URL}/#organization` },
                about: ["WhatsApp system design", "Chat system design", "System design interview"],
              },
              faqPage(FAQ),
            ],
          }),
        }}
      />

      <PageHeader title="Design WhatsApp: a system design interview walkthrough" meta="By SysGeeks">
        Design a secure, real-time chat service by following one message from sender to recipient. This walkthrough
        focuses on delivery guarantees, offline devices, multi-device encryption, and the failures that change the
        architecture. It is an interview proposal, not a description of WhatsApp&apos;s private production systems.
      </PageHeader>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/investigations/chat-message-store" className="btn btn-accent">
          Practise chat message storage
        </Link>
        <Link href="/system-design-mock-interview" className="btn btn-secondary">
          Start a timed mock interview
        </Link>
      </div>

      <Section id="scope" title="Clarify the scope and guarantees">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Start with one-to-one text messages and small groups. Users can connect from several devices, send while a
            recipient is offline, see delivery state, and keep message contents private from the service. Defer calls,
            large groups, search, backups, and media processing until the core delivery path is clear.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>A sender can retry after a timeout without creating a second visible message.</li>
            <li>A message is acknowledged only after the system has accepted responsibility for it.</li>
            <li>Delivery is at least once across retries; clients deduplicate by stable message ID.</li>
            <li>Each device receives ciphertext it can decrypt, while the server routes without message plaintext.</li>
          </ul>
          <p>
            State the retention promise explicitly. This proposal stores encrypted messages only until each target device
            acknowledges delivery or the message expires. A system that supports durable history and multi-device
            recovery needs a different storage and backup contract.
          </p>
        </div>
      </Section>

      <Section id="estimate" title="Estimate message and connection load">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Use labeled assumptions rather than claiming real WhatsApp traffic. Suppose 100 million daily users send 40
            messages each: 4 billion messages per day, about 46,000 per second on average. A 10× peak is roughly
            460,000 messages per second before multi-device fan-out, retries, receipts, and group expansion.
          </p>
          <p>
            Persistent connections add a separate capacity problem. If 50 million devices are connected at once, gateway
            memory, heartbeat traffic, reconnect storms, and regional failover matter as much as message throughput.
            Measure both the number of live connections and the oldest undelivered message.
          </p>
        </div>
      </Section>

      <Section id="architecture" title="A defensible high-level design">
        <ol className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["Client and key directory", "Clients hold private keys and encrypt message content. A directory returns the current set of recipient device identities and public keys; it does not expose private keys to the service."],
            ["Connection gateways", "Maintain authenticated persistent connections and route a device to its home gateway. Keep connection state in memory, with a registry or lease so another service can locate the active connection."],
            ["Message ingress", "Validate the sender, assign or verify a stable message ID, apply abuse and size limits, and resolve the recipient device list. Avoid logging plaintext or sensitive message metadata."],
            ["Durable delivery queue", "Write encrypted envelopes to a partition keyed by recipient device. The successful durable write is the sender's acceptance point; partitioning by recipient preserves per-device ordering where required."],
            ["Delivery workers", "Deliver queued envelopes over the recipient's live connection. Retry after disconnect, deduplicate by message ID, and remove an item only after the recipient's defined acknowledgement."],
            ["Push notification service", "When no device is connected, send a minimal wake-up signal through the platform push service. The client reconnects and fetches ciphertext from the queue; push delivery is not treated as reliable message delivery."],
            ["Receipt and group services", "Track delivery and read receipts as separate events. For groups, resolve membership and fan out to recipient devices in bounded batches, with explicit limits and retry state."],
          ].map(([title, text], i) => (
            <li key={title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-4">
              <span className="pt-0.5 font-heading text-[1.125rem] text-ink-3 tabular-nums">{i + 1}</span>
              <div>
                <h3 className="text-[0.9375rem] font-medium">{title}</h3>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="message-flow" title="Trace a message from send to delivery">
        <ol className="max-w-[72ch] list-decimal space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>The sender encrypts the message for the recipient&apos;s current devices and submits envelopes with one message ID.</li>
          <li>Ingress checks authorization and limits, resolves device keys, and writes the envelopes to durable recipient queues.</li>
          <li>After the durable write, the sender receives an accepted acknowledgement; this does not mean a recipient has received it.</li>
          <li>Delivery workers push envelopes to online devices. Offline devices keep their envelopes until reconnect or expiry.</li>
          <li>A client stores the message locally, deduplicates retries, and acknowledges the message ID. The service records a delivery receipt.</li>
          <li>For a group, fan-out proceeds in bounded batches. Partial progress is durable so a worker retry does not restart the whole group.</li>
        </ol>
        <p className="mt-4 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Separate accepted, delivered, and read states. A single “sent” flag cannot explain whether the message is safe
          to retry, waiting for an offline device, or already shown to a person.
        </p>
      </Section>

      <Section id="multi-device" title="Multi-device fan-out changes the cost model">
        <div className="max-w-[72ch] space-y-4 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            If one account has several devices, the sender may encrypt a copy for every device instead of asking the
            server to decrypt once and redistribute plaintext. This preserves end-to-end encryption but multiplies
            encryption work, queue writes, and delivery state. A device added or revoked while a send is in flight also
            makes the recipient list time-sensitive.
          </p>
          <p>
            Meta has described WhatsApp&apos;s multi-device approach as client fan-out: the sending client encrypts and
            transmits separately for the sender&apos;s and recipient&apos;s devices. That public description is a useful
            source for this trade-off, not a complete blueprint for the service. For the exercise, version the device
            list and define whether a message targets the snapshot taken at send time or triggers a retry after the
            list changes.
          </p>
        </div>
      </Section>

      <Section id="failures" title="Failures that expose gaps in the design">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {[
            ["Ingress times out after queue commit", "The client retries with the same message ID. Ingress returns the original acceptance result, and the queue's idempotency key prevents a duplicate."],
            ["A gateway dies with millions of open connections", "Clients reconnect with jitter to another gateway. The connection registry expires stale leases, and message delivery resumes from durable queue state."],
            ["A recipient disconnects after receiving but before acknowledging", "The envelope may be sent again. The client deduplicates by message ID before displaying it, then repeats the acknowledgement."],
            ["A push provider is delayed or unavailable", "Keep the encrypted message in the queue and retry push within limits. The client can still fetch messages on its next reconnect; push is only a wake-up optimization."],
            ["A group fan-out worker crashes halfway through", "Persist per-recipient progress and retry the remaining batch. Use stable message IDs and idempotent queue writes to tolerate replay."],
            ["An account revokes a linked device", "Stop issuing new envelopes to that device after the key directory commits the revocation. Define how already queued ciphertext expires or is cancelled; do not claim revocation can erase a message already delivered."],
          ].map(([failure, response]) => (
            <div key={failure} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[15rem_minmax(0,1fr)]">
              <dt className="text-[0.9375rem] font-medium">{failure}</dt>
              <dd className="text-[0.9375rem] leading-relaxed text-ink-2">{response}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="answer" title="A concise interview answer">
        <blockquote className="max-w-[72ch] border-l-2 border-rule pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            “I&apos;ll design one-to-one and small-group text messaging first. Clients encrypt for the recipient&apos;s
            devices, then submit stable message IDs to an ingress service. We acknowledge after encrypted envelopes
            reach a durable, per-device queue. Gateways deliver to online clients over persistent connections; offline
            messages wait in bounded queues, and push notifications only wake clients. Retries are at least once, so
            clients deduplicate before displaying and acknowledge after local persistence. I&apos;ll next test reconnect
            storms, group fan-out, device revocation, and the privacy cost of receipts.”
          </p>
        </blockquote>
        <p className="mt-4 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Then let the interviewer choose the next deep dive: large groups, media delivery, encrypted backups, calls,
          abuse controls, or multi-device history sync. Keep each feature&apos;s privacy and delivery guarantee explicit.
        </p>
      </Section>

      <Section id="sources" title="Published sources and scope">
        <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-ink-2">
          <li>
            <a className="link" href="https://engineering.fb.com/2021/07/14/security/whatsapp-multi-device/">
              Meta Engineering: How WhatsApp enables multi-device capability
            </a>{" "}
            describes per-device identity keys, client fan-out, and how message history is synchronized across devices.
          </li>
          <li>
            <a className="link" href="https://engineering.fb.com/2024/03/06/security/whatsapp-messenger-messaging-interoperability-eu/">
              Meta Engineering: WhatsApp messaging interoperability
            </a>{" "}
            explains the interoperability design, Signal Protocol foundations, persistent client connections, and a
            simplified technical architecture. Those details describe interoperability, not every internal WhatsApp
            service.
          </li>
          <li>
            <a className="link" href="https://engineering.fb.com/2021/09/10/security/whatsapp-e2ee-backups/">
              Meta Engineering: End-to-end encrypted WhatsApp backups
            </a>{" "}
            discusses the separate key-management problem involved in protecting backups.
          </li>
        </ul>
        <p className="mt-4 max-w-[72ch] text-[0.8125rem] leading-relaxed text-ink-3">
          The architecture and capacity values on this page are SysGeeks interview assumptions. They are not claims
          about WhatsApp&apos;s private production design or current traffic.
        </p>
      </Section>

      <Section id="faq" title="WhatsApp system design interview questions">
        <dl className="max-w-[72ch] divide-y divide-rule border-y border-rule">
          {FAQ.map(({ question, answer }) => (
            <div key={question} className="py-4">
              <dt className="text-[0.9375rem] font-medium">{question}</dt>
              <dd className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </article>
  );
}
