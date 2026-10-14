type Service = { id: number; name: string; status: string; updatedAt?: Date };
type Dependency = { serviceId: number; dependsOnId: number };
type Event = { serviceId: number | null; type: string; createdAt: Date };

/** Dependency exposure is evidence of risk, not a measured failure deadline. */
export function serviceRiskSignals(services: Service[], dependencies: Dependency[], events: Event[]) {
  const byId = new Map(services.map(service => [service.id, service]));
  const counts = new Map<number, number>();
  for (const event of events) {
    const service = event.serviceId ? byId.get(event.serviceId) : undefined;
    if (!service || !["failure", "alert"].includes(event.type)) continue;
    if (service.status === "healthy" && service.updatedAt && event.createdAt < service.updatedAt) continue;
    counts.set(service.id, (counts.get(service.id) ?? 0) + 1);
  }
  return services.flatMap(service => {
    if (service.status === "failing") return [];
    const upstream = dependencies.filter(edge => edge.serviceId === service.id)
      .flatMap(edge => byId.get(edge.dependsOnId) ?? []);
    const failing = upstream.find(dependency => dependency.status === "failing");
    const degraded = upstream.find(dependency => dependency.status === "degraded");
    const count = counts.get(service.id) ?? 0;
    const riskLevel = failing ? "high" : degraded || ["at_risk", "degraded"].includes(service.status) ? "medium" : count >= 3 ? "low" : null;
    if (!riskLevel) return [];
    return [{ service: service.name, serviceId: service.id, riskLevel, timeToFailure: "Not estimated",
      reason: failing ? `Depends on failing ${failing.name}` : degraded ? `Depends on degraded ${degraded.name}`
        : ["at_risk", "degraded"].includes(service.status) ? `Recorded status: ${service.status}` : `${count} alerts in the last 6 hours` }];
  }).sort((a, b) => ["high", "medium", "low"].indexOf(a.riskLevel) - ["high", "medium", "low"].indexOf(b.riskLevel)).slice(0, 4);
}
